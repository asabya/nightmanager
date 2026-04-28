import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export const SUBAGENTS_CONFIG_PATH = join(homedir(), ".pi", "agent", "nightmanager.json");
export const DEFAULT_SUBAGENT_THINKING = "medium";
export function parseModelReference(input) {
    const parts = input.split("/");
    if (parts.length < 2)
        return null;
    const [provider, ...rest] = parts;
    const modelId = rest.join("/");
    if (!provider || !modelId)
        return null;
    return { provider, modelId };
}
function normalizeThinkingLevel(value) {
    return value === "high" || value === "xhigh" ? value : DEFAULT_SUBAGENT_THINKING;
}
function normalizeSubagentConfig(value) {
    if (!value || typeof value !== "object")
        return {};
    const raw = value;
    return {
        ...(typeof raw.model === "string" && raw.model.trim() ? { model: raw.model.trim() } : {}),
        thinking: normalizeThinkingLevel(raw.thinking),
    };
}
export function loadNightmanagerConfig(configPath = SUBAGENTS_CONFIG_PATH) {
    if (!existsSync(configPath))
        return null;
    try {
        const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
        if (!parsed || typeof parsed !== "object")
            return null;
        const rawAgents = parsed.agents;
        if (!rawAgents || typeof rawAgents !== "object")
            return { agents: {} };
        const agents = {};
        for (const name of ["finder", "oracle", "worker", "manager"]) {
            const normalized = normalizeSubagentConfig(rawAgents[name]);
            if (normalized.model || normalized.thinking)
                agents[name] = normalized;
        }
        return { agents };
    }
    catch {
        return null;
    }
}
export function resolveSubagentConfig(ctx, name, config = loadNightmanagerConfig()) {
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
//# sourceMappingURL=models.js.map