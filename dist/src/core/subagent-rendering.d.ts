import { Text } from "@mariozechner/pi-tui";
import type { SubagentName, SubagentTranscriptDetails, TranscriptEntry } from "./transcript.js";
interface SubagentRenderState {
    subagentSpinnerInterval?: ReturnType<typeof setInterval>;
    subagentSpinnerStartedAt?: number;
}
interface SubagentRenderContext {
    state?: SubagentRenderState;
    lastComponent?: unknown;
    invalidate?: () => void;
    isError?: boolean;
}
export declare function formatSubagentCall(tool: SubagentName, task: string): string;
export declare function renderSubagentCall(tool: SubagentName, task: string, isPartial?: boolean, isError?: boolean, context?: SubagentRenderContext): Text;
export declare function formatTranscriptEntry(entry: TranscriptEntry): string;
export declare function buildCollapsedPreview(details: SubagentTranscriptDetails, isPartial?: boolean, spinnerIcon?: string): string;
export declare function buildExpandedTranscript(details: SubagentTranscriptDetails, spinnerIcon?: string): string;
export declare function renderSubagentResult(details: SubagentTranscriptDetails, expandedOrOptions: boolean | {
    expanded: boolean;
    isPartial?: boolean;
}, _theme: unknown, context?: SubagentRenderContext): Text;
export {};
