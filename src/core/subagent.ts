import type { Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Agent, type ThinkingLevel } from "@mariozechner/pi-agent-core";
import { stream } from "@mariozechner/pi-ai";
import { basename } from "node:path";
import { extractFinalText } from "./result.js";
import {
  type SubagentName,
  type ToolName,
  type SubagentTranscriptDetails,
  createTranscriptState,
  appendAssistantText,
  appendToolCall,
  appendToolResult,
  setTranscriptUsage,
  finalizeTranscriptDetails,
} from "./transcript.js";

/**
 * Rich result returned from runIsolatedSubagent
 */
export interface SubagentResult {
  finalText: string;
  details: SubagentTranscriptDetails;
}

/**
 * Text content block for onUpdate callback
 */
export interface TextContentBlock {
  type: "text";
  text: string;
}

/**
 * Update callback for live transcript events
 */
export type SubagentUpdateCallback = (update: {
  content: TextContentBlock[];
  details: SubagentTranscriptDetails;
}) => void;

/**
 * Options for runIsolatedSubagent with full result and live updates
 * 
 * subagentName is required.
 */
export interface RunIsolatedSubagentOptions {
  /** The subagent type (finder, oracle, worker, manager) - required */
  subagentName: SubagentName;
  /** Callback for live transcript updates */
  onUpdate?: SubagentUpdateCallback;
  // Common options
  ctx: ExtensionContext;
  model: Model<any>;
  systemPrompt: string;
  tools: any[];
  task: string;
  thinkingLevel?: ThinkingLevel;
  signal?: AbortSignal;
  timeoutMs: number;
}

/**
 * Run an isolated subagent with live transcript updates
 * 
 * Returns SubagentResult with finalText and details.
 */
export async function runIsolatedSubagent(
  options: RunIsolatedSubagentOptions
): Promise<SubagentResult> {
  return runIsolatedSubagentImpl(options);
}

/**
 * Internal implementation
 */
function buildTaskPrompt(task: string, cwd?: string): string {
  if (!cwd?.trim()) return task;

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

function bindToolContext(tool: any, ctx: ExtensionContext): any {
  if (typeof tool?.execute !== "function" || tool.execute.length < 5) return tool;

  return {
    ...tool,
    execute: (toolCallId: string, params: unknown, signal?: AbortSignal, onUpdate?: (partial: any) => void) =>
      tool.execute(toolCallId, params, signal, onUpdate, ctx),
  };
}

async function runIsolatedSubagentImpl(
  options: RunIsolatedSubagentOptions
): Promise<SubagentResult> {
  const {
    ctx,
    model,
    systemPrompt,
    tools,
    task,
    signal,
    timeoutMs,
    subagentName,
    onUpdate,
    thinkingLevel = "medium",
  } = options;

  const timeoutAbort = new AbortController();
  const timeoutId = setTimeout(() => timeoutAbort.abort(), timeoutMs);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutAbort.signal])
    : timeoutAbort.signal;

  // Initialize transcript state
  let transcriptState = createTranscriptState(subagentName, task);

  // Helper to emit updates
  const emitUpdate = (
    update: Partial<SubagentTranscriptDetails>,
    isFinal: boolean = false
  ) => {
    if (!onUpdate) return;

    // Build the complete details object
    let completeDetails: SubagentTranscriptDetails;
    
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
        usage: update.usage ?? transcriptState.usage,
        entries: [...transcriptState.entries],
      };
    } else {
      // For intermediate updates, use partial details
      completeDetails = {
        tool: transcriptState.tool,
        task: transcriptState.task,
        status: update.status || "running",
        usage: update.usage ?? transcriptState.usage,
        entries: [...transcriptState.entries],
      };
    }

    // Extract current text from entries for content block
    let currentText: string | undefined;
    if (isFinal && completeDetails.finalText) {
      currentText = completeDetails.finalText;
    } else {
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
    const content: TextContentBlock[] = currentText
      ? [{ type: "text", text: currentText }]
      : [];

    onUpdate({
      content,
      details: completeDetails,
    });
  };

  let unsubscribe: (() => void) | undefined;

  try {
    const resolvedAuth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!resolvedAuth.ok) {
      const errorMsg = (resolvedAuth as unknown as { error?: string }).error || "Authentication failed";
      throw new Error(errorMsg);
    }

    const boundTools = tools.map((tool) => bindToolContext(tool, ctx));

    // Create the agent
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools: boundTools,
        thinkingLevel,
      },
      streamFn: (messages, context, streamOptions) =>
        stream(messages, context, {
          ...streamOptions,
          signal: combinedSignal,
          apiKey: resolvedAuth.apiKey,
          headers: resolvedAuth.headers,
        }),
    });

    // Subscribe to agent events for transcript updates
    let hasStreamingText = false;

    const collectTextBlocks = (content: Array<{ type: string; text?: string }>): string =>
      content
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("");

    const normalizeUsage = (usage: unknown) => {
      if (!usage || typeof usage !== "object") return undefined;
      const value = usage as Record<string, unknown>;
      if (typeof value.input !== "number" || typeof value.output !== "number") return undefined;
      const cost = value.cost && typeof value.cost === "object" ? (value.cost as Record<string, unknown>).total : undefined;
      return {
        input: value.input,
        output: value.output,
        ...(typeof value.cacheRead === "number" ? { cacheRead: value.cacheRead } : {}),
        ...(typeof value.cacheWrite === "number" ? { cacheWrite: value.cacheWrite } : {}),
        ...(typeof cost === "number" ? { cost } : {}),
      };
    };

    const captureUsage = (message: unknown): boolean => {
      const usage = normalizeUsage((message as { usage?: unknown } | undefined)?.usage);
      if (!usage) return false;
      transcriptState = setTranscriptUsage(transcriptState, usage);
      return true;
    };

    const reconcileFinalAssistantText = (finalAssistantText: string, timestamp: number): void => {
      for (let i = transcriptState.entries.length - 1; i >= 0; i--) {
        const entry = transcriptState.entries[i];
        if (entry.type !== "assistant_text") continue;
        if (entry.text === finalAssistantText && entry.streaming === false) return;

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

    let unsubscribe: (() => void) | undefined;
    unsubscribe = agent.subscribe(async (event) => {
      const timestamp = Date.now();

      switch (event.type) {
        case "message_update": {
          const message = event.message;
          // Safe access for assistantMessageEvent delta
          const assistantEvent = event.assistantMessageEvent as { delta?: string } | undefined;
          const delta = assistantEvent?.delta;

          if (message.role === "assistant" && Array.isArray(message.content)) {
            const usageChanged = captureUsage(message);
            const fallbackText = collectTextBlocks(message.content as Array<{ type: string; text?: string }>);
            const textToAppend = delta || fallbackText;

            if (textToAppend) {
              transcriptState = appendAssistantText(transcriptState, textToAppend, timestamp, true);
              hasStreamingText = true;
              emitUpdate({});
            } else if (usageChanged) {
              emitUpdate({});
            }
          }
          break;
        }

        case "message_end": {
          const message = event.message;
          if (message.role === "assistant" && Array.isArray(message.content)) {
            const usageChanged = captureUsage(message);
            const finalAssistantText = collectTextBlocks(message.content as Array<{ type: string; text?: string }>);
            if (finalAssistantText) {
              if (!hasStreamingText) {
                transcriptState = appendAssistantText(transcriptState, finalAssistantText, timestamp, false);
              } else {
                reconcileFinalAssistantText(finalAssistantText, timestamp);
              }
              emitUpdate({});
            } else if (usageChanged) {
              emitUpdate({});
            }
          }
          break;
        }

        case "tool_execution_start": {
          // Record tool call start
          transcriptState = appendToolCall(
            transcriptState,
            event.toolName as ToolName,
            event.args,
            timestamp,
            event.toolCallId
          );
          emitUpdate({});
          break;
        }

        case "tool_execution_end": {
          // Record tool result
          transcriptState = appendToolResult(
            transcriptState,
            event.toolName as ToolName,
            event.result?.content?.[0]?.type === "text"
              ? (event.result.content[0] as { text?: string }).text
              : undefined,
            event.isError,
            timestamp,
            event.toolCallId
          );
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
    const finalText = extractFinalText(
      agent.state.messages as Array<{ role: string; content?: unknown }>
    );

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
  } catch (error) {
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
  } finally {
    unsubscribe?.();
    clearTimeout(timeoutId);
  }
}