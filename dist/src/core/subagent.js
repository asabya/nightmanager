import { Agent } from "@mariozechner/pi-agent-core";
import { stream } from "@mariozechner/pi-ai";
import { basename } from "node:path";
import { extractFinalText } from "./result.js";
import { createTranscriptState, appendAssistantText, appendToolCall, appendToolResult, finalizeTranscriptDetails, } from "./transcript.js";
/**
 * Run an isolated subagent with live transcript updates
 *
 * Returns SubagentResult with finalText and details.
 */
export async function runIsolatedSubagent(options) {
    return runIsolatedSubagentImpl(options);
}
/**
 * Internal implementation
 */
function buildTaskPrompt(task, cwd) {
    if (!cwd?.trim())
        return task;
    return [
        "Workspace context:",
        `- Current working directory: ${cwd}`,
        `- Project directory name: ${basename(cwd)}`,
        '- Unless the user says otherwise, references like "this project", "current project", and "here" refer to this workspace.',
        "",
        "User task:",
        task,
    ].join("\n");
}
function bindToolContext(tool, ctx) {
    if (typeof tool?.execute !== "function" || tool.execute.length < 5)
        return tool;
    return {
        ...tool,
        execute: (toolCallId, params, signal, onUpdate) => tool.execute(toolCallId, params, signal, onUpdate, ctx),
    };
}
async function runIsolatedSubagentImpl(options) {
    const { ctx, model, systemPrompt, tools, task, signal, timeoutMs, subagentName, onUpdate, } = options;
    const timeoutAbort = new AbortController();
    const timeoutId = setTimeout(() => timeoutAbort.abort(), timeoutMs);
    const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutAbort.signal])
        : timeoutAbort.signal;
    // Initialize transcript state
    let transcriptState = createTranscriptState(subagentName, task);
    // Helper to emit updates
    const emitUpdate = (update, isFinal = false) => {
        if (!onUpdate)
            return;
        // Build the complete details object
        let completeDetails;
        if (isFinal) {
            // For final update, include all finalized details
            const finalText = update.finalText ||
                (() => {
                    for (let i = transcriptState.entries.length - 1; i >= 0; i--) {
                        const entry = transcriptState.entries[i];
                        if (entry.type === "assistant_text") {
                            return entry.text;
                        }
                    }
                    return undefined;
                })();
            completeDetails = {
                tool: transcriptState.tool,
                task: transcriptState.task,
                status: update.status || "completed",
                finalText,
                model: model.name,
                entries: [...transcriptState.entries],
            };
        }
        else {
            // For intermediate updates, use partial details
            completeDetails = {
                tool: transcriptState.tool,
                task: transcriptState.task,
                status: update.status || "running",
                entries: [...transcriptState.entries],
            };
        }
        // Extract current text from entries for content block
        let currentText;
        if (isFinal && completeDetails.finalText) {
            currentText = completeDetails.finalText;
        }
        else {
            // For running state, get the latest assistant text
            for (let i = completeDetails.entries.length - 1; i >= 0; i--) {
                const entry = completeDetails.entries[i];
                if (entry.type === "assistant_text") {
                    currentText = entry.text;
                    break;
                }
            }
        }
        // Build content as array of text blocks
        const content = currentText
            ? [{ type: "text", text: currentText }]
            : [];
        onUpdate({
            content,
            details: completeDetails,
        });
    };
    let unsubscribe;
    try {
        const resolvedAuth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
        if (!resolvedAuth.ok) {
            const errorMsg = resolvedAuth.error || "Authentication failed";
            throw new Error(errorMsg);
        }
        const boundTools = tools.map((tool) => bindToolContext(tool, ctx));
        // Create the agent
        const agent = new Agent({
            initialState: {
                systemPrompt,
                model,
                tools: boundTools,
            },
            streamFn: (messages, context, streamOptions) => stream(messages, context, {
                ...streamOptions,
                signal: combinedSignal,
                apiKey: resolvedAuth.apiKey,
                headers: resolvedAuth.headers,
            }),
        });
        // Subscribe to agent events for transcript updates
        let hasStreamingText = false;
        const collectTextBlocks = (content) => content
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text)
            .join("");
        const reconcileFinalAssistantText = (finalAssistantText, timestamp) => {
            for (let i = transcriptState.entries.length - 1; i >= 0; i--) {
                const entry = transcriptState.entries[i];
                if (entry.type !== "assistant_text")
                    continue;
                if (entry.text === finalAssistantText && entry.streaming === false)
                    return;
                const entries = [...transcriptState.entries];
                entries[i] = {
                    ...entry,
                    text: finalAssistantText,
                    streaming: false,
                    timestamp: entry.timestamp ?? timestamp,
                };
                transcriptState = { ...transcriptState, entries };
                return;
            }
            transcriptState = appendAssistantText(transcriptState, finalAssistantText, timestamp, false);
        };
        let unsubscribe;
        unsubscribe = agent.subscribe(async (event) => {
            const timestamp = Date.now();
            switch (event.type) {
                case "message_update": {
                    const message = event.message;
                    // Safe access for assistantMessageEvent delta
                    const assistantEvent = event.assistantMessageEvent;
                    const delta = assistantEvent?.delta;
                    if (message.role === "assistant" && Array.isArray(message.content)) {
                        const fallbackText = collectTextBlocks(message.content);
                        const textToAppend = delta || fallbackText;
                        if (textToAppend) {
                            transcriptState = appendAssistantText(transcriptState, textToAppend, timestamp, true);
                            hasStreamingText = true;
                            emitUpdate({});
                        }
                    }
                    break;
                }
                case "message_end": {
                    const message = event.message;
                    if (message.role === "assistant" && Array.isArray(message.content)) {
                        const finalAssistantText = collectTextBlocks(message.content);
                        if (finalAssistantText) {
                            if (!hasStreamingText) {
                                transcriptState = appendAssistantText(transcriptState, finalAssistantText, timestamp, false);
                            }
                            else {
                                reconcileFinalAssistantText(finalAssistantText, timestamp);
                            }
                            emitUpdate({});
                        }
                    }
                    break;
                }
                case "tool_execution_start": {
                    // Record tool call start
                    transcriptState = appendToolCall(transcriptState, event.toolName, event.args, timestamp, event.toolCallId);
                    emitUpdate({});
                    break;
                }
                case "tool_execution_end": {
                    // Record tool result
                    transcriptState = appendToolResult(transcriptState, event.toolName, event.result?.content?.[0]?.type === "text"
                        ? event.result.content[0].text
                        : undefined, event.isError, timestamp, event.toolCallId);
                    emitUpdate({});
                    break;
                }
            }
        });
        // Execute the subagent
        await agent.prompt({
            role: "user",
            content: [{ type: "text", text: buildTaskPrompt(task, ctx.cwd) }],
            timestamp: Date.now(),
        });
        await agent.waitForIdle();
        // Extract final text from the agent's messages
        const finalText = extractFinalText(agent.state.messages);
        // Finalize the transcript details
        const details = finalizeTranscriptDetails(transcriptState, {
            status: "completed",
            finalText,
            model: model.name,
        });
        if (onUpdate) {
            onUpdate({
                content: finalText ? [{ type: "text", text: finalText }] : [],
                details,
            });
        }
        return {
            finalText,
            details,
        };
    }
    catch (error) {
        const status = timeoutAbort.signal.aborted
            ? "timed_out"
            : error instanceof Error && error.name === "AbortError"
                ? "aborted"
                : "error";
        const details = finalizeTranscriptDetails(transcriptState, {
            status,
        });
        if (onUpdate) {
            onUpdate({
                content: [],
                details,
            });
        }
        throw error;
    }
    finally {
        unsubscribe?.();
        clearTimeout(timeoutId);
    }
}
//# sourceMappingURL=subagent.js.map