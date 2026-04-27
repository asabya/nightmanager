import { defineTool, createReadTool, createEditTool, createWriteTool, createBashTool, } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { resolveSubagentConfig } from "../core/models.js";
import { renderSubagentCall, renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";
import { WORKER_SYSTEM_PROMPT } from "../core/prompts.js";
import { formatWorkerTask, handoffSchema, writeHandoffArtifact } from "../core/handoff.js";
import { finderTool } from "./finder.js";
const workerSchema = Type.Object({
    task: Type.String({ description: "Implementation task to execute" }),
    handoff: Type.Optional(handoffSchema),
    context: Type.Optional(Type.String({ description: "Concise caller-provided context or prior delegate findings" })),
    targetFiles: Type.Optional(Type.Array(Type.String(), { description: "Known files to inspect or edit first" })),
    constraints: Type.Optional(Type.Array(Type.String(), { description: "Constraints to preserve while implementing" })),
    verification: Type.Optional(Type.Array(Type.String(), { description: "Suggested verification commands" })),
    _source: Type.Optional(Type.Union([
        Type.Literal("manager"),
        Type.Literal("direct-worker"),
    ], { description: "Internal: source of the handoff for artifact creation" })),
});
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
        const transcript = result.details?.transcript;
        if (transcript)
            return renderSubagentResult(transcript, options, theme, context);
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (!params.task.trim()) {
            return {
                content: [{ type: "text", text: "Error: Please provide a non-empty task." }],
                details: { error: "empty_task" },
                isError: true,
            };
        }
        const subagentConfig = resolveSubagentConfig(ctx, "worker");
        const model = subagentConfig.model;
        if (!model) {
            return {
                content: [{ type: "text", text: "Error: No model available for worker subagent." }],
                details: { error: "no_model", configPath: subagentConfig.configPath },
                isError: true,
            };
        }
        // Determine if there's handoff context that requires an artifact
        // _source is an internal parameter set by manager when calling through handoff_to_worker
        const source = params._source || "direct-worker";
        const hasHandoffContext = Boolean(params.handoff?.objective?.trim() ||
            params.handoff?.findings?.length ||
            params.handoff?.targetFiles?.length ||
            params.handoff?.decisions?.length ||
            params.context?.trim() ||
            params.targetFiles?.length ||
            params.constraints?.length ||
            params.verification?.length);
        // Write handoff artifact file if there's handoff context
        let artifactPath;
        if (hasHandoffContext) {
            try {
                artifactPath = await writeHandoffArtifact(params, source);
            }
            catch (error) {
                // Fail clearly if we can't create the artifact
                return {
                    content: [{ type: "text", text: `Error: Failed to create handoff artifact: ${error instanceof Error ? error.message : "Unknown error"}` }],
                    details: { error: "artifact_creation_failed", cause: error },
                    isError: true,
                };
            }
        }
        const formattedTask = formatWorkerTask(params, artifactPath);
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
            thinkingLevel: subagentConfig.thinkingLevel,
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
                artifactPath,
                finderFallbackUsed: finderUses > 0,
                transcript: result.details,
            },
        };
    },
});
//# sourceMappingURL=worker.js.map