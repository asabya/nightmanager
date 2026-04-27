import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { resolveSubagentConfig } from "../core/models.js";
import { renderSubagentCall, renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";
import { MANAGER_SYSTEM_PROMPT } from "../core/prompts.js";
import { handoffEvidenceSchema, handoffVerificationSchema, nonEmptyStringArraySchema } from "../core/handoff.js";
import { finderTool } from "./finder.js";
import { oracleTool } from "./oracle.js";
import { workerTool } from "./worker.js";
const managerSchema = Type.Object({
    query: Type.String({ description: "Task to plan and orchestrate" }),
});
const requiredWorkerHandoffSchema = Type.Object({
    objective: Type.String({ description: "Concrete implementation objective distilled from user/finder/oracle context" }),
    findings: nonEmptyStringArraySchema("Key findings from finder, oracle, manager, or user context"),
    targetFiles: nonEmptyStringArraySchema("Primary files worker must inspect or edit first"),
    relatedFiles: Type.Optional(Type.Array(Type.String(), { description: "Additional files useful for context or tests" })),
    decisions: nonEmptyStringArraySchema("Implementation decisions or reasoning conclusions worker should follow"),
    constraints: Type.Optional(Type.Array(Type.String(), { description: "Constraints worker must preserve" })),
    risks: Type.Optional(Type.Array(Type.String(), { description: "Known risks or edge cases" })),
    verification: Type.Optional(handoffVerificationSchema),
    evidence: Type.Optional(Type.Array(handoffEvidenceSchema)),
    rawContext: Type.Optional(Type.String({ description: "Additional concise handoff context" })),
});
const handoffToWorkerSchema = Type.Object({
    task: Type.String({ description: "Implementation task for worker" }),
    handoff: requiredWorkerHandoffSchema,
    context: Type.Optional(Type.String({ description: "Extra concise context for worker" })),
    constraints: Type.Optional(Type.Array(Type.String(), { description: "Additional constraints for worker" })),
    verification: Type.Optional(Type.Array(Type.String(), { description: "Additional verification commands for worker" })),
});
function extractTextExcerpt(result, maxLength = 2_000) {
    const content = result?.content;
    const text = content
        ?.filter((block) => block?.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n")
        .trim();
    if (!text)
        return undefined;
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
function hasNonBlank(items) {
    return Array.isArray(items) && items.some((item) => item.trim().length > 0);
}
function validateHandoffToWorkerInput(params) {
    const missing = [];
    const handoff = params.handoff;
    if (!params.task?.trim())
        missing.push("task");
    if (!handoff)
        return [...missing, "handoff"];
    if (!handoff.objective?.trim())
        missing.push("handoff.objective");
    if (!hasNonBlank(handoff.findings))
        missing.push("handoff.findings");
    if (!hasNonBlank(handoff.targetFiles))
        missing.push("handoff.targetFiles");
    if (!hasNonBlank(handoff.decisions))
        missing.push("handoff.decisions");
    return missing;
}
const handoffToWorkerTool = defineTool({
    name: "handoff_to_worker",
    label: "Handoff to Worker",
    description: "Invoke worker with a required structured handoff. This is Manager's only implementation path.",
    promptSnippet: "Use handoff_to_worker to call worker only after providing objective, findings, target files, and decisions.",
    promptGuidelines: [
        "Use this instead of worker for every implementation step inside manager.",
        "Populate handoff from finder/oracle/user context so worker does not rediscover prior work.",
    ],
    parameters: handoffToWorkerSchema,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
        const missing = validateHandoffToWorkerInput(params);
        if (missing.length > 0) {
            return {
                content: [{
                        type: "text",
                        text: `Error: handoff_to_worker requires non-empty ${missing.join(", ")}. Call finder/oracle first if you do not have enough context.`,
                    }],
                details: { error: "invalid_worker_handoff", missing },
                isError: true,
            };
        }
        return workerTool.execute(toolCallId, { ...params, _source: "manager" }, signal, onUpdate, ctx);
    },
});
export const managerTool = defineTool({
    name: "manager",
    label: "Manager",
    description: "Launch an orchestration subagent that plans and coordinates finder, oracle, and worker workflows.",
    promptSnippet: "Use manager for multi-step tasks that may need coordinated finder -> oracle -> worker workflows.",
    promptGuidelines: [
        "Use manager when a task spans discovery, reasoning, and implementation phases.",
        "Manager orchestrates finder/oracle/worker as needed, but does not inspect or edit files directly.",
    ],
    parameters: managerSchema,
    renderCall(args, _theme, context) {
        return renderSubagentCall("manager", args.query ?? "", context.isPartial, context.isError, context);
    },
    renderResult(result, options, theme, context) {
        const transcript = result.details?.transcript;
        if (transcript)
            return renderSubagentResult(transcript, options, theme, context);
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
        const subagentConfig = resolveSubagentConfig(ctx, "manager");
        const model = subagentConfig.model;
        if (!model) {
            return {
                content: [{ type: "text", text: "Error: No model available for manager subagent." }],
                details: { error: "no_model", configPath: subagentConfig.configPath },
                isError: true,
            };
        }
        const delegateCalls = [];
        const trackDelegation = (tool) => defineTool({
            ...tool,
            async execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx) {
                const record = {
                    tool: String(tool.name ?? "unknown"),
                    params: toolParams,
                    status: "running",
                    timestamp: Date.now(),
                };
                delegateCalls.push(record);
                try {
                    const result = await tool.execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx);
                    record.status = result?.isError ? "failed" : "completed";
                    record.isError = Boolean(result?.isError);
                    record.summary = extractTextExcerpt(result);
                    return result;
                }
                catch (error) {
                    record.status = "failed";
                    record.isError = true;
                    throw error;
                }
            },
        });
        const result = await runIsolatedSubagent({
            subagentName: "manager",
            onUpdate: (partial) => {
                _onUpdate?.({
                    content: partial.content,
                    details: {
                        query: params.query,
                        delegated: delegateCalls.length > 0,
                        delegateCalls: [...delegateCalls],
                        transcript: partial.details,
                    },
                });
            },
            ctx,
            model,
            thinkingLevel: subagentConfig.thinkingLevel,
            systemPrompt: MANAGER_SYSTEM_PROMPT,
            tools: [trackDelegation(finderTool), trackDelegation(oracleTool), trackDelegation(handoffToWorkerTool)],
            task: params.query,
            signal,
            timeoutMs: 600_000,
        });
        return {
            content: [{ type: "text", text: result.finalText }],
            details: {
                query: params.query,
                delegated: delegateCalls.length > 0,
                delegateCalls: [...delegateCalls],
                transcript: result.details,
            },
        };
    },
});
//# sourceMappingURL=manager.js.map