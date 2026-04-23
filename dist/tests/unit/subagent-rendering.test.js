import { describe, expect, it } from "vitest";
import { buildCollapsedPreview, formatTranscriptEntry } from "../../src/core/subagent-rendering.js";
describe("subagent rendering helpers", () => {
    it("formats terse human-readable tool call lines", () => {
        const line = formatTranscriptEntry({
            type: "tool_call",
            toolName: "read",
            args: { path: "/tmp/project/README.md" },
            timestamp: 1,
        });
        expect(line).toContain("Read /tmp/project/README.md");
    });
    it("builds a collapsed preview with expand hint", () => {
        const text = buildCollapsedPreview({
            tool: "finder",
            task: "Inspect README",
            status: "completed",
            finalText: "## Findings\nDone",
            entries: [
                { type: "status", text: "starting", timestamp: 1 },
                { type: "tool_call", toolName: "read", args: { path: "/tmp/project/README.md" }, timestamp: 2 },
                { type: "tool_result", toolName: "read", text: "Loaded README", timestamp: 3 },
            ],
        });
        expect(text).toContain("finder");
        expect(text).toContain("Done");
        expect(text).toContain("Ctrl+O to expand");
    });
});
//# sourceMappingURL=subagent-rendering.test.js.map