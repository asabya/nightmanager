import { describe, expect, it } from "vitest";
import {
  buildCollapsedPreview,
  buildExpandedTranscript,
  formatTranscriptEntry,
  formatSubagentCall,
} from "../../src/core/subagent-rendering.js";

describe("subagent rendering helpers", () => {
  it("formats terse human-readable tool call lines", () => {
    const line = formatTranscriptEntry({
      type: "tool_call",
      toolName: "read",
      args: { path: "/tmp/project/README.md" },
      timestamp: 1,
    });

    expect(line).toBe("Read README.md");
  });

  it("builds a professional subagent task header", () => {
    expect(formatSubagentCall("finder", "Inspect README")).toBe("Finder Task - Inspect README");
  });

  it("formats manager handoff-to-worker calls", () => {
    const line = formatTranscriptEntry({
      type: "tool_call",
      toolName: "handoff_to_worker",
      args: { task: "Implement the selected fix" },
      timestamp: 1,
    });

    expect(line).toBe("Handoff to Worker Implement the selected fix");
  });

  it("builds a collapsed preview with latest tool calls first and a more hint", () => {
    const text = buildCollapsedPreview({
      tool: "finder",
      task: "Inspect README",
      status: "running",
      finalText: "Summary: Done",
      entries: [
        { type: "tool_call", toolName: "read", args: { path: "/tmp/project/README.md" }, timestamp: 1, toolCallId: "1" },
        { type: "tool_result", toolName: "read", text: "Loaded README", timestamp: 2, toolCallId: "1" },
        { type: "tool_call", toolName: "grep", args: { pattern: "foo" }, timestamp: 3, toolCallId: "2" },
        { type: "tool_call", toolName: "find", args: { pattern: "*.ts" }, timestamp: 4, toolCallId: "3" },
        { type: "tool_call", toolName: "bash", args: { command: "pwd" }, timestamp: 5, toolCallId: "4" },
      ],
    }, true);

    expect(text.split("\n")[0]).toContain("Bash pwd");
    expect(text).toContain("Find *.ts");
    expect(text).toContain("Grep foo");
    expect(text).toContain("+ 1 More (Press Ctrl+O to see)");
  });

  it("builds an expanded transcript with latest tool calls first and final response", () => {
    const text = buildExpandedTranscript({
      tool: "finder",
      task: "Inspect README",
      status: "completed",
      finalText: "Summary: Done",
      entries: [
        { type: "tool_call", toolName: "read", args: { path: "/tmp/project/README.md" }, timestamp: 1, toolCallId: "1" },
        { type: "tool_result", toolName: "read", text: "Loaded README", timestamp: 2, toolCallId: "1" },
        { type: "tool_call", toolName: "grep", args: { pattern: "foo" }, timestamp: 3, toolCallId: "2" },
      ],
    });

    expect(text).toContain("Status: completed");
    expect(text.indexOf("Grep foo")).toBeLessThan(text.indexOf("Read README.md"));
    expect(text).toContain("Response\nSummary: Done");
  });
});
