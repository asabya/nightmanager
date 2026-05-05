import { describe, expect, it } from "vitest";
import {
  buildCollapsedPreview,
  buildExpandedTranscript,
  formatTranscriptEntry,
  formatSubagentCall,
  formatUsageLabel,
  formatManagerDelegateUsageLine,
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

  it("formats and renders usage labels", () => {
    expect(formatUsageLabel({ input: 8400, output: 2200, cost: 0.019, totalTokens: 5200, contextWindow: 272000 })).toBe("↑8.4k ↓2.2k $0.019 1.9%/272k");

    const collapsed = buildCollapsedPreview({
      tool: "finder",
      task: "Inspect README",
      status: "running",
      usage: { input: 8400, output: 2200, cost: 0.019 },
      entries: [
        { type: "tool_call", toolName: "read", args: { path: "/tmp/project/README.md" }, timestamp: 1, toolCallId: "1" },
      ],
    }, true);
    expect(collapsed.split("\n")[0]).toBe("   ↑8.4k ↓2.2k $0.019");
  });

  it("renders manager delegate usage lines with placeholders, real usage, and worker naming", () => {
    expect(formatManagerDelegateUsageLine({
      tool: "oracle",
      params: { query: "reason about update propagation" },
      status: "running",
      timestamp: 1,
      contextWindow: 200000,
    })).toBe("⠼ Oracle reason about update propagation · $0.000 0.0%/200k");

    expect(formatManagerDelegateUsageLine({
      tool: "handoff_to_worker",
      params: { task: "patch manager delegate usage" },
      status: "completed",
      timestamp: 1,
      usage: { input: 9800, output: 1100, cost: 0.022, totalTokens: 10900, contextWindow: 200000 },
    })).toBe("✓ Worker patch manager delegate usage · ↑9.8k ↓1.1k $0.022 5.5%/200k");
  });

  it("builds collapsed and expanded manager previews with one row per delegate call", () => {
    const details = {
      tool: "manager" as const,
      task: "orchestrate",
      status: "running" as const,
      usage: { input: 12100, output: 1400, cost: 0.031, totalTokens: 13500, contextWindow: 200000 },
      entries: [
        { type: "tool_call" as const, toolName: "finder" as const, args: { query: "search render usage paths" }, timestamp: 1, toolCallId: "delegate-1" },
        { type: "tool_call" as const, toolName: "handoff_to_worker" as const, args: { task: "patch manager delegate usage" }, timestamp: 3, toolCallId: "delegate-3" },
        { type: "tool_call" as const, toolName: "bash" as const, args: { command: "pwd" }, timestamp: 5, toolCallId: "internal-1" },
      ],
      managerDelegateCalls: [
        { tool: "finder", params: { query: "search render usage paths" }, status: "completed" as const, timestamp: 1, toolCallId: "delegate-1", usage: { input: 3200, output: 420, cost: 0.004, totalTokens: 3620, contextWindow: 200000 } },
        { tool: "oracle", params: { query: "reason about updates" }, status: "running" as const, timestamp: 2, contextWindow: 272000 },
        { tool: "handoff_to_worker", params: { task: "patch manager delegate usage" }, status: "failed" as const, timestamp: 3, toolCallId: "delegate-3", contextWindow: 200000 },
        { tool: "finder", params: { query: "second pass" }, status: "running" as const, timestamp: 4, contextWindow: 200000 },
      ],
    };

    const collapsed = buildCollapsedPreview(details, true);
    expect(collapsed).toContain("↑12.1k ↓1.4k $0.031 6.8%/200k");
    expect(collapsed).toContain("✓ Finder search render usage paths · ↑3.2k ↓420 $0.004 1.8%/200k");
    expect(collapsed).toContain("⠼ Oracle reason about updates · $0.000 0.0%/272k");
    expect(collapsed).toContain("✕ Worker patch manager delegate usage · $0.000 0.0%/200k");
    expect(collapsed).toContain("⠼ Finder second pass · $0.000 0.0%/200k");
    expect(collapsed).toContain("⠼ Bash pwd");
    expect(collapsed).not.toContain("Handoff to Worker patch manager delegate usage");
    expect(collapsed.match(/search render usage paths/g)).toHaveLength(1);

    const expanded = buildExpandedTranscript(details);
    expect(expanded).toContain("Delegate Usage");
    expect(expanded).toContain("Worker patch manager delegate usage");
    expect(expanded).toContain("- ⠼ Bash pwd");
    expect(expanded).not.toContain("- ✓ Finder search render usage paths");
    expect(expanded).not.toContain("Handoff to Worker patch manager delegate usage");
  });

  it("keeps the manager delegate row updated without showing the raw delegate tool call", () => {
    const details = {
      tool: "manager" as const,
      task: "orchestrate",
      status: "running" as const,
      entries: [
        { type: "tool_call" as const, toolName: "oracle" as const, args: { query: "reason about updates" }, timestamp: 1, toolCallId: "delegate-1" },
      ],
      managerDelegateCalls: [
        { tool: "oracle", params: { query: "reason about updates" }, status: "running" as const, timestamp: 1, toolCallId: "delegate-1", contextWindow: 272000 },
      ],
    };

    expect(buildCollapsedPreview(details, true)).toContain("⠼ Oracle reason about updates · $0.000 0.0%/272k");
    expect(buildCollapsedPreview(details, true).match(/Oracle reason about updates/g)).toHaveLength(1);

    const updated = {
      ...details,
      managerDelegateCalls: [
        { ...details.managerDelegateCalls[0], usage: { input: 4200, output: 600, cost: 0.011, totalTokens: 4800, contextWindow: 272000 } },
      ],
    };

    const collapsed = buildCollapsedPreview(updated, true);
    expect(collapsed).toContain("⠼ Oracle reason about updates · ↑4.2k ↓600 $0.011 1.8%/272k");
    expect(collapsed.match(/Oracle reason about updates/g)).toHaveLength(1);
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
