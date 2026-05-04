import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/subagent.js", () => ({
  runIsolatedSubagent: vi.fn(async (options: { subagentName: string; task: string }) => ({
    finalText: "## Summary\nDone",
    details: {
      tool: options.subagentName,
      task: options.task,
      status: "completed",
      finalText: "## Summary\nDone",
      entries: [
        { type: "tool_call", toolName: "read", args: { path: "/tmp/project/README.md" }, timestamp: 1 },
      ],
    },
  })),
}));

import { runIsolatedSubagent } from "../../src/core/subagent.js";
import { finderTool } from "../../src/tools/finder.js";
import { oracleTool } from "../../src/tools/oracle.js";
import { workerTool } from "../../src/tools/worker.js";
import { managerTool } from "../../src/tools/manager.js";
import { librarianTool, LIBRARIAN_SYSTEM_PROMPT } from "../../src/tools/librarian.js";

const ctx = {
  cwd: process.cwd(),
  model: { provider: "test", id: "model", name: "model" },
  modelRegistry: {
    find() {
      return { provider: "test", id: "model", name: "model" };
    },
    async getApiKeyAndHeaders() {
      return { ok: true, apiKey: "test", headers: {} };
    },
  },
} as any;

describe("subagent tools", () => {
  it("finder returns concise content with transcript-bearing details", async () => {
    const result = await finderTool.execute("tool-1", { query: "inspect README" }, undefined, undefined, ctx);
    expect(result.content[0]).toMatchObject({ type: "text", text: "## Summary\nDone" });
    expect(result.details).toMatchObject({ query: "inspect README" });
    expect((result.details as any).transcript).toMatchObject({ tool: "finder" });
  });

  it("worker passes structured handoff context into the isolated subagent task", async () => {
    const mockedRun = vi.mocked(runIsolatedSubagent);
    mockedRun.mockClear();

    const result = await workerTool.execute("tool-2", {
      task: "Fix expired token handling",
      handoff: {
        objective: "Return TOKEN_EXPIRED for expired tokens.",
        targetFiles: ["src/auth/middleware.ts"],
        decisions: ["Oracle recommends preserving ExpiredTokenError."],
        verification: { suggestedCommands: ["npm test -- tests/auth/middleware.test.ts"] },
      },
    }, undefined, undefined, ctx);

    const task = mockedRun.mock.calls[0]?.[0]?.task;
    expect(task).toContain("Handoff context:");
    expect(task).toContain("src/auth/middleware.ts");
    expect(task).toContain("Oracle recommends preserving ExpiredTokenError.");
    expect(result.details).toMatchObject({ task: "Fix expired token handling", hasHandoff: true });
  });

  it("all public tools expose custom renderers", () => {
    expect(typeof finderTool.renderCall).toBe("function");
    expect(typeof finderTool.renderResult).toBe("function");
    expect(typeof oracleTool.renderCall).toBe("function");
    expect(typeof oracleTool.renderResult).toBe("function");
    expect(typeof workerTool.renderCall).toBe("function");
    expect(typeof workerTool.renderResult).toBe("function");
    expect(typeof managerTool.renderCall).toBe("function");
    expect(typeof managerTool.renderResult).toBe("function");
    expect(typeof librarianTool.renderCall).toBe("function");
    expect(typeof librarianTool.renderResult).toBe("function");
  });

  it("librarian wires GitHub-first discovery, /tmp clone analysis, and external research tools", async () => {
    const mockedRun = vi.mocked(runIsolatedSubagent);
    mockedRun.mockClear();

    await librarianTool.execute("tool-3", { query: "How does zod parse async refinements?" }, undefined, undefined, ctx);

    const options = mockedRun.mock.calls[0]?.[0];
    expect(options?.subagentName).toBe("librarian");
    expect(options?.task).toContain("github_repo_discovery first");
    expect(options?.task).toContain("pass that exact ref to github_clone");
    expect(options?.task).toContain("compare 2-3 repos by default");
    expect(options?.task).toContain("split 6+ repos into batches");
    expect(options?.task).toContain("Rank comparison findings by API correctness, question fit, recency/current implementation, then documentation/example quality");
    expect(options?.task).toContain("pinned to the github_clone commit");
    expect(options?.task).toContain("state uncertainty and stop");
    expect(options?.tools.map((tool: any) => tool.name)).toEqual(expect.arrayContaining([
      "github_repo_discovery",
      "github_clone",
      "web_search",
      "code_search",
      "read",
      "grep",
      "find",
      "ls",
    ]));
    expect(options?.tools.map((tool: any) => tool.name)).not.toContain("bash");
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain("Use github_repo_discovery first");
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain("pass that ref to github_clone and stop if checkout fails");
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain("Compare 4-5 only when the user explicitly provides them");
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain("Rank findings in this order: API correctness, closest fit to the user's question, recency/current implementation, then documentation/example quality");
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain("https://github.com/<owner>/<repo>/blob/<commit>/<path>#L<start>-L<end>");
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain("If decisive source/code evidence remains weak");
  });
});
