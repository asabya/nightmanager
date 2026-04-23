import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";
import { Text } from "@mariozechner/pi-tui";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";
import { MANAGER_SYSTEM_PROMPT } from "../core/prompts.js";
import { finderTool } from "./finder.js";
import { oracleTool } from "./oracle.js";
import { workerTool } from "./worker.js";
const managerSchema = Type.Object({
    query: Type.String({ description: "Task to classify and route" }),
});
const MANAGER_CONFIG_PATH = join(homedir(), ".pi", "agent", "manager.json");
export const managerTool = defineTool({
    name: "manager",
    label: "Manager",
    description: "Launch a lightweight routing subagent that chooses the best next specialized tool.",
    promptSnippet: "Use manager when you want a lightweight read-only router to choose the best next specialized subagent.",
    promptGuidelines: [
        "Use manager when the task may need routing to finder, oracle, or worker.",
        "Manager is read-only and delegates to exactly one best-fit subagent by default.",
    ],
    parameters: managerSchema,
    renderCall(args) {
        const preview = args.query.length > 60 ? `${args.query.slice(0, 57)}...` : args.query;
        return new Text(`manager ${preview}`, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
        const transcript = result.details?.transcript;
        if (transcript)
            return renderSubagentResult(transcript, expanded, theme);
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (!params.query.trim()) {
            return {
                content: [{ type: "text", text: "Error: Please provide a non-empty query." }],
                details: { error: "empty_query" },
                isError: true,
            };
        }
        const configured = loadToolConfig(MANAGER_CONFIG_PATH)?.model;
        const parsed = configured ? parseModelReference(configured) : null;
        const model = parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
        if (!model) {
            return {
                content: [{ type: "text", text: "Error: No model available for manager subagent." }],
                details: { error: "no_model", configPath: MANAGER_CONFIG_PATH },
                isError: true,
            };
        }
        let delegated = false;
        const oneShot = (tool) => defineTool({
            ...tool,
            async execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx) {
                if (delegated) {
                    return {
                        content: [{ type: "text", text: "Error: manager already delegated once for this task." }],
                        details: { error: "delegation_budget_exhausted" },
                        isError: true,
                    };
                }
                delegated = true;
                return tool.execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx);
            },
        });
        const result = await runIsolatedSubagent({
            subagentName: "manager",
            onUpdate: (partial) => {
                _onUpdate?.({
                    content: partial.content,
                    details: { query: params.query, delegated, transcript: partial.details },
                });
            },
            ctx,
            model,
            systemPrompt: MANAGER_SYSTEM_PROMPT,
            tools: [oneShot(finderTool), oneShot(oracleTool), oneShot(workerTool)],
            task: params.query,
            signal,
            timeoutMs: 120_000,
        });
        return {
            content: [{ type: "text", text: result.finalText }],
            details: { query: params.query, delegated, transcript: result.details },
        };
    },
});
//# sourceMappingURL=manager.js.map