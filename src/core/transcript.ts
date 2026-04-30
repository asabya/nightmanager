// Types for Subagent Transcript System

// Subagent names are the high-level agent types
export type SubagentName = "finder" | "oracle" | "worker" | "manager";

// Inner tool names are actual tools that can be called within a subagent
// These include file operations, shell commands, and other utilities
export type InnerToolName = "read" | "write" | "grep" | "find" | "ls" | "bash" | "edit" | "finder" | "handoff_to_worker";

// Tool name can be either a subagent name or an inner tool name
export type ToolName = SubagentName | InnerToolName;

export type TranscriptStatus = "starting" | "running" | "completed" | "error" | "aborted" | "timed_out";

export type TranscriptEntry =
  | { type: "status"; text: string; timestamp: number }
  | { type: "assistant_text"; text: string; timestamp: number; streaming?: boolean }
  | { type: "tool_call"; toolName: ToolName; args: Record<string, unknown>; timestamp: number; toolCallId?: string }
  | { type: "tool_result"; toolName: ToolName; text?: string; isError?: boolean; timestamp: number; toolCallId?: string };

export interface TranscriptUsage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: number;
  turns?: number;
}

export interface SubagentTranscriptDetails {
  tool: SubagentName;
  task: string;
  status: TranscriptStatus;
  finalText?: string;
  model?: string;
  usage?: TranscriptUsage;
  entries: TranscriptEntry[];
}

export interface TranscriptState {
  tool: SubagentName;
  task: string;
  entries: TranscriptEntry[];
  usage?: TranscriptUsage;
}

// Factory function to create initial transcript state
export function createTranscriptState(tool: SubagentName, task: string): TranscriptState {
  return {
    tool,
    task,
    entries: [],
  };
}

// Helper to find insertion index for maintaining chronological order
function findInsertionIndex(entries: TranscriptEntry[], timestamp: number): number {
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
function insertEntryChronologically(
  entries: TranscriptEntry[],
  newEntry: TranscriptEntry
): TranscriptEntry[] {
  const insertIndex = findInsertionIndex(entries, newEntry.timestamp);

  const newEntries = [...entries];
  newEntries.splice(insertIndex, 0, newEntry);
  return newEntries;
}

// Type guard to check if entry is assistant_text with streaming
function isStreamingAssistantText(
  entry: TranscriptEntry | undefined
): entry is { type: "assistant_text"; text: string; timestamp: number; streaming?: boolean } {
  return (
    entry !== undefined &&
    entry.type === "assistant_text" &&
    entry.streaming === true
  );
}

// Helper to get previous mergeable assistant_text entry and its index (if any)
function getPreviousMergeableEntry(
  entries: TranscriptEntry[],
  insertIndex: number
): { entry: { type: "assistant_text"; text: string; timestamp: number; streaming?: boolean }; index: number } | undefined {
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
function appendEntry(
  state: TranscriptState,
  newEntry: TranscriptEntry
): TranscriptState {
  return {
    ...state,
    entries: insertEntryChronologically(state.entries, newEntry),
  };
}

// Append assistant text to the transcript
// If streaming=true and previous CHRONOLOGICAL entry (in array order) is also streaming assistant_text, merge them
export function appendAssistantText(
  state: TranscriptState,
  text: string,
  timestamp: number,
  streaming: boolean
): TranscriptState {
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
export function appendStatus(
  state: TranscriptState,
  text: string,
  timestamp: number
): TranscriptState {
  return appendEntry(state, {
    type: "status",
    text,
    timestamp,
  });
}

export function setTranscriptUsage(
  state: TranscriptState,
  usage: TranscriptUsage
): TranscriptState {
  return { ...state, usage };
}

// Append a tool call entry to the transcript
export function appendToolCall(
  state: TranscriptState,
  toolName: ToolName,
  args: Record<string, unknown>,
  timestamp: number,
  toolCallId?: string
): TranscriptState {
  return appendEntry(state, {
    type: "tool_call",
    toolName,
    args,
    timestamp,
    ...(toolCallId ? { toolCallId } : {}),
  });
}

// Append a tool result entry to the transcript
export function appendToolResult(
  state: TranscriptState,
  toolName: ToolName,
  text: string | undefined,
  isError: boolean | undefined,
  timestamp: number,
  toolCallId?: string
): TranscriptState {
  return appendEntry(state, {
    type: "tool_result",
    toolName,
    text,
    isError,
    timestamp,
    ...(toolCallId ? { toolCallId } : {}),
  });
}

// Options for finalizing transcript details
export interface FinalizeOptions {
  status: TranscriptStatus;
  finalText?: string;
  model?: string;
  usage?: TranscriptUsage;
}

// Finalize transcript details from state
export function finalizeTranscriptDetails(
  state: TranscriptState,
  options: FinalizeOptions
): SubagentTranscriptDetails {
  // Use explicit finalText if provided, otherwise derive from last assistant_text entry
  let finalText: string | undefined = options.finalText;

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
    usage: options.usage ?? state.usage,
    entries: [...state.entries],
  };
}