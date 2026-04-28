import type { Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { type ThinkingLevel } from "@mariozechner/pi-agent-core";
import { type SubagentName, type SubagentTranscriptDetails } from "./transcript.js";
/**
 * Rich result returned from runIsolatedSubagent
 */
export interface SubagentResult {
    finalText: string;
    details: SubagentTranscriptDetails;
}
/**
 * Text content block for onUpdate callback
 */
export interface TextContentBlock {
    type: "text";
    text: string;
}
/**
 * Update callback for live transcript events
 */
export type SubagentUpdateCallback = (update: {
    content: TextContentBlock[];
    details: SubagentTranscriptDetails;
}) => void;
/**
 * Options for runIsolatedSubagent with full result and live updates
 *
 * subagentName is required.
 */
export interface RunIsolatedSubagentOptions {
    /** The subagent type (finder, oracle, worker, manager) - required */
    subagentName: SubagentName;
    /** Callback for live transcript updates */
    onUpdate?: SubagentUpdateCallback;
    ctx: ExtensionContext;
    model: Model<any>;
    systemPrompt: string;
    tools: any[];
    task: string;
    thinkingLevel?: ThinkingLevel;
    signal?: AbortSignal;
    timeoutMs: number;
}
/**
 * Run an isolated subagent with live transcript updates
 *
 * Returns SubagentResult with finalText and details.
 */
export declare function runIsolatedSubagent(options: RunIsolatedSubagentOptions): Promise<SubagentResult>;
