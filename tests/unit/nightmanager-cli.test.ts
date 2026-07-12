import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../../bin/nightmanager.js";

function cli(...args: string[]): number {
  return run(["node", "nightmanager", ...args]);
}

describe("nightmanager CLI arg parsing", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  const stderr = () => errorSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");

  it("no args prints usage and fails", () => {
    expect(cli()).toBe(1);
    expect(logSpy.mock.calls.join("\n")).toContain("Usage:");
  });

  it("--help succeeds", () => {
    expect(cli("--help")).toBe(0);
    expect(cli("-h")).toBe(0);
  });

  it("rejects an unknown flag instead of silently ignoring it", () => {
    expect(cli("install", "claude", "--froce")).toBe(1);
    expect(stderr()).toContain('unknown flag "--froce"');
  });

  it("rejects --user combined with --project", () => {
    expect(cli("install", "claude", "--user", "--project")).toBe(1);
    expect(stderr()).toContain("mutually exclusive");
  });

  it("rejects unexpected positional arguments", () => {
    expect(cli("install", "claude", "extra")).toBe(1);
    expect(stderr()).toContain('unexpected argument "extra"');
  });

  it("rejects an unknown command", () => {
    expect(cli("uninstall", "claude")).toBe(1);
    expect(stderr()).toContain("unknown command");
  });

  it("accepts an explicit --user flag", () => {
    // --dry-run writes nothing, so exercising user scope against the real home is safe.
    expect(cli("install", "claude", "--user", "--dry-run")).toBe(0);
  });

  it("--dry-run reports without writing", () => {
    const cwd = mkdtempSync(join(tmpdir(), "nm-cli-proj-"));
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(cwd);
    try {
      expect(cli("install", "claude", "--project", "--dry-run")).toBe(0);
      expect(existsSync(join(cwd, ".claude"))).toBe(false);
      expect(logSpy.mock.calls.join("\n")).toContain("Would install");
    } finally {
      cwdSpy.mockRestore();
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
