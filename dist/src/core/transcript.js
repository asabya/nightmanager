// Types for Subagent Transcript System
// Factory function to create initial transcript state
export function createTranscriptState(tool, task) {
    return {
        tool,
        task,
        entries: [],
    };
}
// Helper to find insertion index for maintaining chronological order
function findInsertionIndex(entries, timestamp) {
    let insertIndex = 0;
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].timestamp > timestamp) {
            insertIndex = i;
            break;
        }
        insertIndex = i + 1;
    }
    return insertIndex;
}
// Helper function to insert entry in chronological order (by timestamp)
function insertEntryChronologically(entries, newEntry) {
    const insertIndex = findInsertionIndex(entries, newEntry.timestamp);
    const newEntries = [...entries];
    newEntries.splice(insertIndex, 0, newEntry);
    return newEntries;
}
// Type guard to check if entry is assistant_text with streaming
function isStreamingAssistantText(entry) {
    return (entry !== undefined &&
        entry.type === "assistant_text" &&
        entry.streaming === true);
}
// Helper to get previous mergeable assistant_text entry and its index (if any)
function getPreviousMergeableEntry(entries, insertIndex) {
    if (insertIndex === 0) {
        return undefined;
    }
    const previousEntry = entries[insertIndex - 1];
    if (isStreamingAssistantText(previousEntry)) {
        return { entry: previousEntry, index: insertIndex - 1 };
    }
    return undefined;
}
// Internal helper to append any entry type
function appendEntry(state, newEntry) {
    return {
        ...state,
        entries: insertEntryChronologically(state.entries, newEntry),
    };
}
// Append assistant text to the transcript
// If streaming=true and previous CHRONOLOGICAL entry (in array order) is also streaming assistant_text, merge them
export function appendAssistantText(state, text, timestamp, streaming) {
    const insertIndex = findInsertionIndex(state.entries, timestamp);
    // Check if we should merge with the previous chronological entry
    const previous = streaming
        ? getPreviousMergeableEntry(state.entries, insertIndex)
        : undefined;
    if (previous) {
        const entries = [...state.entries];
        entries[previous.index] = {
            ...previous.entry,
            text: previous.entry.text + text,
        };
        return { ...state, entries };
    }
    // Not merging, add new entry in chronological order
    return appendEntry(state, {
        type: "assistant_text",
        text,
        timestamp,
        streaming,
    });
}
// Append a status entry to the transcript
export function appendStatus(state, text, timestamp) {
    return appendEntry(state, {
        type: "status",
        text,
        timestamp,
    });
}
// Append a tool call entry to the transcript
export function appendToolCall(state, toolName, args, timestamp) {
    return appendEntry(state, {
        type: "tool_call",
        toolName,
        args,
        timestamp,
    });
}
// Append a tool result entry to the transcript
export function appendToolResult(state, toolName, text, isError, timestamp) {
    return appendEntry(state, {
        type: "tool_result",
        toolName,
        text,
        isError,
        timestamp,
    });
}
// Finalize transcript details from state
export function finalizeTranscriptDetails(state, options) {
    // Use explicit finalText if provided, otherwise derive from last assistant_text entry
    let finalText = options.finalText;
    if (finalText === undefined) {
        // Derive from last assistant_text entry only if not provided
        for (let i = state.entries.length - 1; i >= 0; i--) {
            const entry = state.entries[i];
            if (entry.type === "assistant_text") {
                finalText = entry.text;
                break;
            }
        }
    }
    return {
        tool: state.tool,
        task: state.task,
        status: options.status,
        finalText,
        model: options.model,
        usage: options.usage,
        entries: [...state.entries],
    };
}
//# sourceMappingURL=transcript.js.map