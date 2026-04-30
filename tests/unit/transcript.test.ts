import { describe, it, expect } from "vitest";
import {
  createTranscriptState,
  appendStatus,
  appendAssistantText,
  appendToolCall,
  appendToolResult,
  setTranscriptUsage,
  finalizeTranscriptDetails,
  SubagentName,
  TranscriptStatus,
} from "../../src/core/transcript.js";

describe("transcript", () => {
  describe("createTranscriptState", () => {
    it("should create initial state with tool and task", () => {
      const state = createTranscriptState("finder" as SubagentName, "test task");
      expect(state.tool).toBe("finder");
      expect(state.task).toBe("test task");
      expect(state.entries).toEqual([]);
    });
  });

  describe("appendStatus", () => {
    it("should append status entry to transcript", () => {
      const state = createTranscriptState("finder" as SubagentName, "test task");
      const updated = appendStatus(state, "starting work", 1000);
      
      expect(updated.entries).toHaveLength(1);
      expect(updated.entries[0]).toEqual({
        type: "status",
        text: "starting work",
        timestamp: 1000,
      });
    });
  });

  describe("appendAssistantText - streaming merge", () => {
    it("should merge streamed assistant text into one chronological entry", () => {
      const state = createTranscriptState("worker" as SubagentName, "test task");
      
      // First streaming text at timestamp 1000
      let updated = appendAssistantText(state, "Hello ", 1000, true);
      
      // Second streaming text at timestamp 1100 - should merge
      updated = appendAssistantText(updated, "world!", 1100, true);
      
      // Third streaming text at timestamp 1200 - should merge
      updated = appendAssistantText(updated, " How are you?", 1200, true);
      
      // Verify only one entry exists (merged)
      expect(updated.entries).toHaveLength(1);
      expect(updated.entries[0]).toEqual({
        type: "assistant_text",
        text: "Hello world! How are you?",
        timestamp: 1000, // timestamp of first entry
        streaming: true,
      });
    });

    it("should NOT merge when previous entry streaming is false", () => {
      const state = createTranscriptState("worker" as SubagentName, "test task");
      
      // First - non-streaming
      let updated = appendAssistantText(state, "Hello ", 1000, false);
      
      // Second - streaming (should NOT merge as previous was not streaming)
      updated = appendAssistantText(updated, "world!", 1100, true);
      
      // Should have two entries
      expect(updated.entries).toHaveLength(2);
      expect((updated.entries[0] as any).text).toBe("Hello ");
      expect((updated.entries[0] as any).streaming).toBe(false);
      expect((updated.entries[1] as any).text).toBe("world!");
      expect((updated.entries[1] as any).streaming).toBe(true);
    });
  });

  describe("appendToolCall and appendToolResult", () => {
    it("should record tool calls and results in chronological order", () => {
      let state = createTranscriptState("worker" as SubagentName, "test task");
      
      // Add tool call
      state = appendToolCall(state, "finder", { query: "test" }, 1000);
      
      // Add tool result
      state = appendToolResult(state, "finder", "found 5 files", false, 1100);
      
      expect(state.entries).toHaveLength(2);
      
      // Tool call at 1000
      expect((state.entries[0] as any)).toEqual({
        type: "tool_call",
        toolName: "finder",
        args: { query: "test" },
        timestamp: 1000,
      });
      
      // Tool result at 1100
      expect((state.entries[1] as any)).toEqual({
        type: "tool_result",
        toolName: "finder",
        text: "found 5 files",
        isError: false,
        timestamp: 1100,
      });
    });
  });

  describe("finalizeTranscriptDetails", () => {
    it("should finalize summary separated from transcript details", () => {
      let state = createTranscriptState("worker" as SubagentName, "test task");
      
      // Add some entries
      state = appendStatus(state, "starting", 1000);
      state = appendAssistantText(state, "Hello", 1100, false);
      
      const details = finalizeTranscriptDetails(state, {
        status: "completed" as TranscriptStatus,
        finalText: "Explicit final text response",
        model: "gpt-4",
        usage: { input: 100, output: 200 },
      });
      
      // Verify details structure
      expect(details.tool).toBe("worker");
      expect(details.task).toBe("test task");
      expect(details.status).toBe("completed");
      expect(details.model).toBe("gpt-4");
      expect(details.usage).toEqual({ input: 100, output: 200 });
      expect(details.entries).toHaveLength(2);
      expect(details.entries[0].type).toBe("status");
      expect(details.entries[1].type).toBe("assistant_text");
      
      // Verify finalText is the explicit value provided, NOT derived from entries
      expect(details.finalText).toBe("Explicit final text response");
    });

    it("should preserve live usage from transcript state when finalizing", () => {
      let state = createTranscriptState("worker" as SubagentName, "test task");
      state = setTranscriptUsage(state, { input: 1000, output: 250, cacheRead: 50, cacheWrite: 10, cost: 0.012 });

      const details = finalizeTranscriptDetails(state, {
        status: "error" as TranscriptStatus,
      });

      expect(details.usage).toEqual({ input: 1000, output: 250, cacheRead: 50, cacheWrite: 10, cost: 0.012 });
    });

    it("should use derived finalText when not explicitly provided in options", () => {
      let state = createTranscriptState("worker" as SubagentName, "test task");
      
      // Add some entries
      state = appendStatus(state, "starting", 1000);
      state = appendAssistantText(state, "Derived final text", 1100, false);
      
      const details = finalizeTranscriptDetails(state, {
        status: "completed" as TranscriptStatus,
        // No finalText in options - should derive from entries
      });
      
      // Verify finalText is derived from the last assistant_text entry
      expect(details.finalText).toBe("Derived final text");
    });
  });

  describe("chronology preservation", () => {
    it("should maintain chronological order even with out-of-order timestamps", () => {
      let state = createTranscriptState("worker" as SubagentName, "test task");
      
      // Add entries with out-of-order timestamps
      state = appendStatus(state, "first at 3000", 3000);
      state = appendAssistantText(state, "second at 1000", 1000, false);
      state = appendToolCall(state, "finder", { query: "test" }, 2000);
      state = appendToolResult(state, "finder", "result at 4000", false, 4000);
      state = appendStatus(state, "last at 5000", 5000);
      
      // Verify entries are sorted by timestamp
      expect(state.entries).toHaveLength(5);
      expect(state.entries[0].timestamp).toBe(1000);
      expect(state.entries[0].type).toBe("assistant_text");
      expect(state.entries[1].timestamp).toBe(2000);
      expect(state.entries[1].type).toBe("tool_call");
      expect(state.entries[2].timestamp).toBe(3000);
      expect(state.entries[2].type).toBe("status");
      expect(state.entries[3].timestamp).toBe(4000);
      expect(state.entries[3].type).toBe("tool_result");
      expect(state.entries[4].timestamp).toBe(5000);
      expect(state.entries[4].type).toBe("status");
    });

    it("should preserve chronology for streaming merged entries", () => {
      let state = createTranscriptState("worker" as SubagentName, "test task");
      
      // Add an entry first
      state = appendStatus(state, "status at 1000", 1000);
      
      // Add streaming text (this should merge)
      state = appendAssistantText(state, "stream part 1", 2000, true);
      state = appendAssistantText(state, "stream part 2", 3000, true);
      
      // Add another entry after
      state = appendStatus(state, "status at 2500", 2500);
      
      // Verify chronology: 1000, 2000 (merged), 2500, 3000 (merged continuation)
      // The merged entry should maintain the timestamp of the first streaming entry
      expect(state.entries).toHaveLength(3);
      expect(state.entries[0].timestamp).toBe(1000);
      expect(state.entries[1].timestamp).toBe(2000); // merged streaming entry
      expect((state.entries[1] as any).text).toBe("stream part 1stream part 2");
      expect(state.entries[2].timestamp).toBe(2500);
    });

    it("should NOT merge streaming text across intervening entries (chronological previous check)", () => {
      let state = createTranscriptState("worker" as SubagentName, "test task");
      
      // Step 1: assistant_text streaming at 2000
      state = appendAssistantText(state, "Hello ", 2000, true);
      expect(state.entries).toHaveLength(1);
      expect((state.entries[0] as any).text).toBe("Hello ");
      expect(state.entries[0].timestamp).toBe(2000);
      
      // Step 2: some other entry at 2500 (intervening entry)
      state = appendToolCall(state, "finder", { query: "test" }, 2500);
      // Entries are now: [2000: assistant_text, 2500: tool_call]
      expect(state.entries).toHaveLength(2);
      expect(state.entries[0].timestamp).toBe(2000);
      expect(state.entries[1].timestamp).toBe(2500);
      
      // Step 3: Add streaming at 3000
      // The previous array entry is 2500 (tool_call), not 2000 (streaming)
      // So this should NOT merge with 2000 - it's a new entry
      state = appendAssistantText(state, "middle ", 3000, true);
      // Entries are now: [2000: Hello , 2500: tool_call, 3000: middle ]
      expect(state.entries).toHaveLength(3);
      expect(state.entries[0].timestamp).toBe(2000);
      expect((state.entries[0] as any).text).toBe("Hello "); // Not merged!
      expect(state.entries[1].timestamp).toBe(2500);
      expect((state.entries[2] as any).text).toBe("middle "); // New entry, not merged
      
      // Step 4: Add another streaming at 3500 (immediately after 3000 in array)
      // The previous array entry IS 3000 (streaming), so this SHOULD merge
      state = appendAssistantText(state, "world!", 3500, true);
      // Entries are now: [2000: Hello , 2500: tool_call, 3000: middle world!]
      expect(state.entries).toHaveLength(3); // Still 3, merged with 3000
      expect(state.entries[0].timestamp).toBe(2000);
      expect((state.entries[0] as any).text).toBe("Hello "); // Still separate from 2000
      expect(state.entries[1].timestamp).toBe(2500);
      expect(state.entries[2].timestamp).toBe(3000);
      expect((state.entries[2] as any).text).toBe("middle world!"); // Merged!
    });
  });
});