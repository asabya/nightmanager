import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Container, fuzzyFilter, getKeybindings, Input, Text, type Focusable, type SelectItem } from "@mariozechner/pi-tui";
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

async function promptModel(ctx: ExtensionCommandContext, agent: SubagentName, modelOptions: string[]) {
  const items: SelectItem[] = modelOptions.map((value) => ({ value, label: value }));

  const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();
    container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
    container.addChild(new Text(theme.fg("accent", theme.bold(`Model for ${agent}`))));

    const searchInput = new Input();
    container.addChild(searchInput);

    const listContainer = new Container();
    container.addChild(listContainer);

    const help = new Text(theme.fg("dim", "type to fuzzy search • ↑↓ navigate • enter select • esc cancel"));
    container.addChild(help);
    container.addChild(new DynamicBorder((text) => theme.fg("accent", text)));

    let filteredItems = items;
    let selectedIndex = 0;
    let focused = false;

    const updateList = () => {
      listContainer.clear();
      const maxVisible = Math.min(items.length, 10);
      const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), filteredItems.length - maxVisible));
      const endIndex = Math.min(startIndex + maxVisible, filteredItems.length);

      for (let i = startIndex; i < endIndex; i++) {
        const item = filteredItems[i];
        if (!item) continue;
        const isSelected = i === selectedIndex;
        const line = isSelected ? theme.fg("accent", `→ ${item.label}`) : `  ${item.label}`;
        listContainer.addChild(new Text(line, 0, 0));
      }

      if (startIndex > 0 || endIndex < filteredItems.length) {
        listContainer.addChild(new Text(theme.fg("dim", `  (${selectedIndex + 1}/${filteredItems.length})`), 0, 0));
      }

      if (filteredItems.length === 0) {
        listContainer.addChild(new Text(theme.fg("warning", "  No matching models"), 0, 0));
      }
    };

    const getModelSearchText = ({ value }: SelectItem) => {
      const separatorIndex = value.indexOf("/");
      const provider = separatorIndex >= 0 ? value.slice(0, separatorIndex) : "";
      const id = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : value;
      return `${id} ${provider} ${provider}/${id} ${provider} ${id}`;
    };

    const filterModels = (query: string) => {
      filteredItems = query ? fuzzyFilter(items, query, getModelSearchText) : items;
      selectedIndex = Math.min(selectedIndex, Math.max(0, filteredItems.length - 1));
      updateList();
    };

    searchInput.onSubmit = () => {
      const selected = filteredItems[selectedIndex];
      if (selected) done(selected.value);
    };
    updateList();

    return {
      get focused() {
        return focused;
      },
      set focused(value: boolean) {
        focused = value;
        searchInput.focused = value;
      },
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput(data: string) {
        const kb = getKeybindings();
        if (kb.matches(data, "tui.select.up")) {
          if (filteredItems.length > 0) {
            selectedIndex = selectedIndex === 0 ? filteredItems.length - 1 : selectedIndex - 1;
            updateList();
          }
        } else if (kb.matches(data, "tui.select.down")) {
          if (filteredItems.length > 0) {
            selectedIndex = selectedIndex === filteredItems.length - 1 ? 0 : selectedIndex + 1;
            updateList();
          }
        } else if (kb.matches(data, "tui.select.confirm")) {
          const selected = filteredItems[selectedIndex];
          if (selected) done(selected.value);
        } else if (kb.matches(data, "tui.select.cancel")) {
          done(null);
        } else {
          searchInput.handleInput(data);
          filterModels(searchInput.getValue());
        }
        tui.requestRender();
      },
    } satisfies { focused: boolean; render(width: number): string[]; invalidate(): void; handleInput(data: string): void } & Focusable;
  });

  if (!result) return undefined;
  if (!modelOptions.includes(result)) throw new Error(`Unknown model ID: ${result}`);
  return result;
}

async function promptAgentConfig(ctx: ExtensionCommandContext, agent: SubagentName, modelOptions: string[]) {
  const model = await promptModel(ctx, agent, modelOptions);
  if (!model) return undefined;

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
