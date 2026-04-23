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

import { finderTool } from "../../src/tools/finder.js";
import { oracleTool } from "../../src/tools/oracle.js";
import { workerTool } from "../../src/tools/worker.js";
import { managerTool } from "../../src/tools/manager.js";

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

  it("all public tools expose custom renderers", () => {
    expect(typeof finderTool.renderCall).toBe("function");
    expect(typeof finderTool.renderResult).toBe("function");
    expect(typeof oracleTool.renderCall).toBe("function");
    expect(typeof oracleTool.renderResult).toBe("function");
    expect(typeof workerTool.renderCall).toBe("function");
    expect(typeof workerTool.renderResult).toBe("function");
    expect(typeof managerTool.renderCall).toBe("function");
    expect(typeof managerTool.renderResult).toBe("function");
  });
});
