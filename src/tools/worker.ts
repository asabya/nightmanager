import {
  defineTool,
  createReadTool,
  createEditTool,
  createWriteTool,
  createBashTool,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";
import { Text } from "@mariozechner/pi-tui";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { renderSubagentCall, renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";
import { WORKER_SYSTEM_PROMPT } from "../core/prompts.js";
import { formatWorkerTask, handoffSchema } from "../core/handoff.js";
import { finderTool } from "./finder.js";

const workerSchema = Type.Object({
  task: Type.String({ description: "Implementation task to execute" }),
  handoff: Type.Optional(handoffSchema),
  context: Type.Optional(Type.String({ description: "Concise caller-provided context or prior delegate findings" })),
  targetFiles: Type.Optional(Type.Array(Type.String(), { description: "Known files to inspect or edit first" })),
  constraints: Type.Optional(Type.Array(Type.String(), { description: "Constraints to preserve while implementing" })),
  verification: Type.Optional(Type.Array(Type.String(), { description: "Suggested verification commands" })),
});

type WorkerInput = Static<typeof workerSchema>;
const WORKER_CONFIG_PATH = join(homedir(), ".pi", "agent", "worker.json");

export const workerTool = defineTool({
  name: "worker",
  label: "Worker",
  description: "Launch a focused implementation subagent that makes small code changes and verifies them.",
  promptSnippet: "Use worker for focused implementation tasks that need code edits and verification.",
  promptGuidelines: [
    "Use worker for direct implementation work with minimal diffs and concrete verification.",
    "Worker may use finder once when blocked by codebase uncertainty, but does not use oracle or recursively delegate.",
  ],
  parameters: workerSchema,
  renderCall(args, _theme, context) {
    return renderSubagentCall("worker", args.task ?? "", context.isPartial, context.isError, context);
  },
  renderResult(result, options, theme, context) {
    const transcript = (result.details as { transcript?: unknown } | undefined)?.transcript;
    if (transcript) return renderSubagentResult(transcript as any, options, theme, context);
    const text = result.content[0];
    return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
  },
  async execute(_toolCallId, params: WorkerInput, signal, _onUpdate, ctx) {
    if (!params.task.trim()) {
      return {
        content: [{ type: "text", text: "Error: Please provide a non-empty task." }],
        details: { error: "empty_task" },
        isError: true,
      };
    }

    const configured = loadToolConfig(WORKER_CONFIG_PATH)?.model;
    const parsed = configured ? parseModelReference(configured) : null;
    const model = parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
    if (!model) {
      return {
        content: [{ type: "text", text: "Error: No model available for worker subagent." }],
        details: { error: "no_model", configPath: WORKER_CONFIG_PATH },
        isError: true,
      };
    }

    const formattedTask = formatWorkerTask(params);
    const hasHandoff = formattedTask !== params.task;

    let finderUses = 0;
    const limitedFinderTool = defineTool({
      ...finderTool,
      async execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx) {
        if (finderUses >= 1) {
          return {
            content: [{ type: "text", text: "Error: finder fallback already used for this worker task." }],
            details: { error: "finder_fallback_exhausted" },
            isError: true,
          };
        }
        finderUses += 1;
        return finderTool.execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx);
      },
    });

    const result = await runIsolatedSubagent({
      subagentName: "worker",
      onUpdate: (partial) => {
        _onUpdate?.({
          content: partial.content,
          details: {
            task: params.task,
            hasHandoff,
            finderFallbackUsed: finderUses > 0,
            transcript: partial.details,
          },
        });
      },
      ctx,
      model,
      systemPrompt: WORKER_SYSTEM_PROMPT,
      tools: [
        createReadTool(ctx.cwd),
        createEditTool(ctx.cwd),
        createWriteTool(ctx.cwd),
        createBashTool(ctx.cwd),
        limitedFinderTool,
      ],
      task: formattedTask,
      signal,
      timeoutMs: 240_000,
    });

    return {
      content: [{ type: "text", text: result.finalText }],
      details: {
        task: params.task,
        hasHandoff,
        handoff: params.handoff,
        finderFallbackUsed: finderUses > 0,
        transcript: result.details,
      },
    };
  },
});
