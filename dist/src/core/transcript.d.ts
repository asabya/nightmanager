export type SubagentName = "finder" | "oracle" | "worker" | "manager";
export type InnerToolName = "read" | "write" | "grep" | "find" | "ls" | "bash" | "edit" | "finder" | "handoff_to_worker";
export type ToolName = SubagentName | InnerToolName;
export type TranscriptStatus = "starting" | "running" | "completed" | "error" | "aborted" | "timed_out";
export type TranscriptEntry = {
    type: "status";
    text: string;
    timestamp: number;
} | {
    type: "assistant_text";
    text: string;
    timestamp: number;
    streaming?: boolean;
} | {
    type: "tool_call";
    toolName: ToolName;
    args: Record<string, unknown>;
    timestamp: number;
    toolCallId?: string;
} | {
    type: "tool_result";
    toolName: ToolName;
    text?: string;
    isError?: boolean;
    timestamp: number;
    toolCallId?: string;
};
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
}
export declare function createTranscriptState(tool: SubagentName, task: string): TranscriptState;
export declare function appendAssistantText(state: TranscriptState, text: string, timestamp: number, streaming: boolean): TranscriptState;
export declare function appendStatus(state: TranscriptState, text: string, timestamp: number): TranscriptState;
export declare function appendToolCall(state: TranscriptState, toolName: ToolName, args: Record<string, unknown>, timestamp: number, toolCallId?: string): TranscriptState;
export declare function appendToolResult(state: TranscriptState, toolName: ToolName, text: string | undefined, isError: boolean | undefined, timestamp: number, toolCallId?: string): TranscriptState;
export interface FinalizeOptions {
    status: TranscriptStatus;
    finalText?: string;
    model?: string;
    usage?: TranscriptUsage;
}
export declare function finalizeTranscriptDetails(state: TranscriptState, options: FinalizeOptions): SubagentTranscriptDetails;
