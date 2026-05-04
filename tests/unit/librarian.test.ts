import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
const mkdtempMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: mkdtempMock,
  rm: rmMock,
}));

import { githubCloneTool, githubRepoDiscoveryTool } from "../../src/tools/librarian.js";

function successfulGitMock(_file: string, args: string[], _options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void) {
  const stdout = args.includes("rev-parse") ? "abc123def456\n" : "";
  callback(null, stdout, "");
}

describe("librarian helpers", () => {
  beforeEach(() => {
    execFileMock.mockImplementation(successfulGitMock);
    mkdtempMock.mockResolvedValue("/tmp/librarian-owner-repo-ref-abc");
    rmMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("checks out requested commit refs without treating them as branches", async () => {
    const ref = "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d";

    const result = await githubCloneTool.execute("tool-1", { repo: "owner/repo", ref }, undefined, undefined, {} as any);

    const gitArgs = execFileMock.mock.calls.map(call => call[1]);
    expect(gitArgs[0]).toEqual(["clone", "--depth", "1", "--no-checkout", "https://github.com/owner/repo.git", "/tmp/librarian-owner-repo-ref-abc"]);
    expect(gitArgs[0]).not.toContain("--branch");
    expect(gitArgs[1]).toEqual(["-C", "/tmp/librarian-owner-repo-ref-abc", "fetch", "--depth", "1", "origin", ref]);
    expect(gitArgs[2]).toEqual(["-C", "/tmp/librarian-owner-repo-ref-abc", "checkout", "--detach", "FETCH_HEAD"]);
    expect(gitArgs[3]).toEqual(["-C", "/tmp/librarian-owner-repo-ref-abc", "rev-parse", "--verify", "HEAD"]);
    expect(result.details).toMatchObject({ ref, commit: "abc123def456" });
  });

  it("preserves branch and tag refs embedded in GitHub tree URLs when cloning", async () => {
    const result = await githubCloneTool.execute("tool-url", { repo: "https://github.com/owner/repo/tree/release/v1.2.3" }, undefined, undefined, {} as any);

    const gitArgs = execFileMock.mock.calls.map(call => call[1]);
    expect(gitArgs[0]).toEqual(["clone", "--depth", "1", "--no-checkout", "https://github.com/owner/repo.git", "/tmp/librarian-owner-repo-ref-abc"]);
    expect(gitArgs[1]).toEqual(["-C", "/tmp/librarian-owner-repo-ref-abc", "fetch", "--depth", "1", "origin", "release/v1.2.3"]);
    expect(gitArgs[2]).toEqual(["-C", "/tmp/librarian-owner-repo-ref-abc", "checkout", "--detach", "FETCH_HEAD"]);
    expect(result.details).toMatchObject({ repo: "owner/repo", ref: "release/v1.2.3" });
  });

  it("accepts trailing-slash GitHub URLs during discovery", async () => {
    const result = await githubRepoDiscoveryTool.execute("tool-url-discovery", { query: "https://github.com/owner/repo/" }, undefined, undefined, {} as any);

    expect(result.details).toMatchObject({ status: "found", repo: "owner/repo" });
  });

  it("uses every fetched candidate when resolving canonical GitHub repos", async () => {
    const fetchMock = vi.fn(async (url: URL) => ({
      ok: true,
      async json() {
        return {
          items: [
            { full_name: "one/not-it", html_url: "https://github.com/one/not-it", stargazers_count: 900, fork: false, archived: false },
            { full_name: "two/not-it", html_url: "https://github.com/two/not-it", stargazers_count: 800, fork: false, archived: false },
            { full_name: "three/not-it", html_url: "https://github.com/three/not-it", stargazers_count: 700, fork: false, archived: false },
            { full_name: "four/not-it", html_url: "https://github.com/four/not-it", stargazers_count: 600, fork: false, archived: false },
            { full_name: "five/not-it", html_url: "https://github.com/five/not-it", stargazers_count: 500, fork: false, archived: false },
            { full_name: "owner/target", html_url: "https://github.com/owner/target", stargazers_count: 400, fork: false, archived: false },
          ],
        };
      },
      async text() {
        return "";
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await githubRepoDiscoveryTool.execute("tool-2", { query: "target", maxCandidates: 6 }, undefined, undefined, {} as any);

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(requestedUrl.searchParams.get("per_page")).toBe("6");
    expect((result as any).isError).not.toBe(true);
    expect(result.details).toMatchObject({ status: "found", repo: "owner/target" });
  });

  it("resolves scoped package names against normalized GitHub identifiers", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      async json() {
        return {
          items: [
            { full_name: "reduxjs/redux-toolkit", html_url: "https://github.com/reduxjs/redux-toolkit", stargazers_count: 12_000, fork: false, archived: false },
            { full_name: "other/toolkit", html_url: "https://github.com/other/toolkit", stargazers_count: 100, fork: false, archived: false },
          ],
        };
      },
      async text() {
        return "";
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await githubRepoDiscoveryTool.execute("tool-scoped", { query: "@reduxjs/toolkit" }, undefined, undefined, {} as any);

    expect((result as any).isError).not.toBe(true);
    expect(result.details).toMatchObject({ status: "found", repo: "reduxjs/redux-toolkit" });
  });

  it("does not infer canonical upstreams from star count without an exact identifier match", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      async json() {
        return {
          items: [
            { full_name: "popular/unrelated", html_url: "https://github.com/popular/unrelated", stargazers_count: 10_000, fork: false, archived: false },
            { full_name: "other/candidate", html_url: "https://github.com/other/candidate", stargazers_count: 100, fork: false, archived: false },
          ],
        };
      },
      async text() {
        return "";
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await githubRepoDiscoveryTool.execute("tool-3", { query: "package-name" }, undefined, undefined, {} as any);

    expect((result as any).isError).toBe(true);
    expect(result.details).toMatchObject({ status: "ambiguous" });
  });

  it("allows docs fallback when no GitHub upstream candidates are found", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      async json() {
        return { items: [] };
      },
      async text() {
        return "";
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await githubRepoDiscoveryTool.execute("tool-4", { query: "docs-only-package" }, undefined, undefined, {} as any);

    expect((result as any).isError).not.toBe(true);
    expect(result.details).toMatchObject({ status: "not_found", candidates: [] });
    expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("Fall back to official documentation") });
  });
});
