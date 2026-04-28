import type { Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
export type SubagentName = "finder" | "oracle" | "worker" | "manager";
export type SubagentThinkingLevel = Exclude<ThinkingLevel, "off" | "minimal" | "low">;
export interface SubagentConfig {
    model?: string;
    thinking?: SubagentThinkingLevel;
}
export interface SubagentsConfig {
    agents?: Partial<Record<SubagentName, SubagentConfig>>;
}
export interface ParsedModelReference {
    provider: string;
    modelId: string;
}
export interface ResolvedSubagentConfig {
    model: Model<any> | undefined;
    thinkingLevel: SubagentThinkingLevel;
    configPath: string;
    configuredModel?: string;
    invalidModel?: boolean;
}
export declare const SUBAGENTS_CONFIG_PATH: string;
export declare const DEFAULT_SUBAGENT_THINKING: SubagentThinkingLevel;
export declare function parseModelReference(input: string): ParsedModelReference | null;
export declare function loadSubagentsConfig(configPath?: string): SubagentsConfig | null;
export declare function resolveSubagentConfig(ctx: ExtensionContext, name: SubagentName, config?: SubagentsConfig | null): ResolvedSubagentConfig;
