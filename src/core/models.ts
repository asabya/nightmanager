import type { Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type SubagentName = "finder" | "oracle" | "worker" | "manager";
export type SubagentThinkingLevel = Exclude<ThinkingLevel, "off" | "minimal" | "low">;

export interface SubagentConfig {
  model?: string;
  thinking?: SubagentThinkingLevel;
}

export interface NightmanagerConfig {
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

export const SUBAGENTS_CONFIG_PATH = join(homedir(), ".pi", "agent", "subagents.json");
export const DEFAULT_SUBAGENT_THINKING: SubagentThinkingLevel = "medium";

export function parseModelReference(input: string): ParsedModelReference | null {
  const parts = input.split("/");
  if (parts.length < 2) return null;
  const [provider, ...rest] = parts;
  const modelId = rest.join("/");
  if (!provider || !modelId) return null;
  return { provider, modelId };
}

function normalizeThinkingLevel(value: unknown): SubagentThinkingLevel {
  return value === "high" || value === "xhigh" ? value : DEFAULT_SUBAGENT_THINKING;
}

function normalizeSubagentConfig(value: unknown): SubagentConfig {
  if (!value || typeof value !== "object") return {};
  const raw = value as { model?: unknown; thinking?: unknown };
  return {
    ...(typeof raw.model === "string" && raw.model.trim() ? { model: raw.model.trim() } : {}),
    thinking: normalizeThinkingLevel(raw.thinking),
  };
}

export function loadNightmanagerConfig(configPath = SUBAGENTS_CONFIG_PATH): NightmanagerConfig | null {
  if (!existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rawAgents = (parsed as { agents?: unknown }).agents;
    if (!rawAgents || typeof rawAgents !== "object") return { agents: {} };

    const agents: NightmanagerConfig["agents"] = {};
    for (const name of ["finder", "oracle", "worker", "manager"] as const) {
      const normalized = normalizeSubagentConfig((rawAgents as Record<string, unknown>)[name]);
      if (normalized.model || normalized.thinking) agents[name] = normalized;
    }
    return { agents };
  } catch {
    return null;
  }
}

export function resolveSubagentConfig(
  ctx: ExtensionContext,
  name: SubagentName,
  config = loadNightmanagerConfig(),
): ResolvedSubagentConfig {
  const agentConfig = config?.agents?.[name];
  const configuredModel = agentConfig?.model;
  const parsed = configuredModel ? parseModelReference(configuredModel) : null;
  const foundModel = parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) : undefined;

  return {
    model: foundModel ?? ctx.model,
    thinkingLevel: normalizeThinkingLevel(agentConfig?.thinking),
    configPath: SUBAGENTS_CONFIG_PATH,
    ...(configuredModel ? { configuredModel } : {}),
    invalidModel: Boolean(configuredModel && !foundModel),
  };
}
