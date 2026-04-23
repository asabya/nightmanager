import { Text } from "@mariozechner/pi-tui";
import type { SubagentTranscriptDetails, TranscriptEntry } from "./transcript.js";
export declare function formatTranscriptEntry(entry: TranscriptEntry): string;
export declare function buildCollapsedPreview(details: SubagentTranscriptDetails): string;
export declare function buildExpandedTranscript(details: SubagentTranscriptDetails): string;
export declare function renderSubagentResult(details: SubagentTranscriptDetails, expanded: boolean, _theme: unknown): Text;
