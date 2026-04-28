import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SUBAGENTS_CONFIG_PATH, type SubagentName, type SubagentThinkingLevel } from "../core/models.js";

const SUBAGENTS: SubagentName[] = ["manager", "finder", "worker", "oracle"];
const THINKING_LEVELS: SubagentThinkingLevel[] = ["medium", "high", "xhigh"];
const RECOMMENDED_THINKING: Record<SubagentName, SubagentThinkingLevel> = {
  manager: "medium",
  finder: "medium",
  worker: "high",
  oracle: "high",
};

type JsonObject = Record<string, unknown>;
type AgentUpdate = { model: string; thinking: string };

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseTarget(args: string): SubagentName[] | null {
  const target = args.trim();
  if (!target) return SUBAGENTS;
  if ((SUBAGENTS as string[]).includes(target)) return [target as SubagentName];
  return null;
}

async function readConfig(configPath = SUBAGENTS_CONFIG_PATH): Promise<JsonObject> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!isObject(parsed)) throw new Error("Existing nightmanager config must be a JSON object.");
  if (parsed.agents !== undefined && !isObject(parsed.agents)) {
    throw new Error('Existing nightmanager config field "agents" must be a JSON object.');
  }
  return parsed;
}

async function writeAgentConfig(
  updates: Partial<Record<SubagentName, AgentUpdate>>,
  configPath = SUBAGENTS_CONFIG_PATH,
): Promise<void> {
  const config = await readConfig(configPath);
  const agents = isObject(config.agents) ? config.agents : {};

  for (const [name, update] of Object.entries(updates) as Array<[SubagentName, AgentUpdate]>) {
    if (update.thinking === "low") throw new Error('thinking: "low" is not allowed.');
    if (!(THINKING_LEVELS as string[]).includes(update.thinking)) throw new Error(`Unsupported thinking level: ${update.thinking}`);
    const existing = agents[name];
    const agentConfig = isObject(existing) ? existing : {};
    agentConfig.model = update.model;
    agentConfig.thinking = update.thinking as SubagentThinkingLevel;
    agents[name] = agentConfig;
  }

  config.agents = agents;
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function modelReference(model: { provider: string; id: string }): string {
  return `${model.provider}/${model.id}`;
}

async function promptAgentConfig(ctx: ExtensionCommandContext, agent: SubagentName, modelOptions: string[]) {
  const model = await ctx.ui.select(`Model for ${agent}`, modelOptions);
  if (!model) return undefined;
  if (!modelOptions.includes(model)) throw new Error(`Unknown model ID: ${model}`);

  const recommended = RECOMMENDED_THINKING[agent];
  const thinking = await ctx.ui.select(
    `Thinking for ${agent} (recommended: ${recommended})`,
    THINKING_LEVELS,
  );
  if (!thinking) return undefined;
  if (thinking === "low") throw new Error('thinking: "low" is not allowed.');
  if (!(THINKING_LEVELS as string[]).includes(thinking)) throw new Error(`Unsupported thinking level: ${thinking}`);

  return { model, thinking: thinking as SubagentThinkingLevel };
}

export function registerNightconfigCommand(pi: ExtensionAPI): void {
  pi.registerCommand("nightconfig", {
    description: "Configure Nightmanager subagent models and thinking levels.",
    getArgumentCompletions(argumentPrefix) {
      const prefix = argumentPrefix.trim();
      return SUBAGENTS.filter((name) => name.startsWith(prefix)).map((name) => ({ value: name, label: name }));
    },
    async handler(args, ctx) {
      const targets = parseTarget(args);
      if (!targets) {
        ctx.ui.notify(`Usage: /nightconfig [${SUBAGENTS.join("|")}]`, "error");
        return;
      }

      const models = ctx.modelRegistry.getAvailable();
      const modelOptions = models.map(modelReference).sort();
      if (modelOptions.length === 0) {
        ctx.ui.notify("No available Pi models found. Configure model auth before running /nightconfig.", "error");
        return;
      }

      const updates: Partial<Record<SubagentName, AgentUpdate>> = {};
      try {
        for (const agent of targets) {
          const update = await promptAgentConfig(ctx, agent, modelOptions);
          if (!update) {
            ctx.ui.notify("/nightconfig cancelled.", "info");
            return;
          }
          updates[agent] = update;
        }

        await writeAgentConfig(updates);
        ctx.ui.notify(`Updated ${SUBAGENTS_CONFIG_PATH} for ${targets.join(", ")}.`, "info");
      } catch (error) {
        ctx.ui.notify(`Failed to update nightmanager config: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });
}
