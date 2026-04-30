import { Text } from "@mariozechner/pi-tui";
import type { SubagentName, SubagentTranscriptDetails, TranscriptEntry, TranscriptStatus, TranscriptUsage } from "./transcript.js";

const COLLAPSED_TOOL_LIMIT = 3;
const MAX_TASK_PREVIEW = 96;
const MAX_VALUE_PREVIEW = 72;
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_FRAME_MS = 100;
const DEFAULT_SPINNER_FRAME = "⠼";

interface SubagentRenderState {
  subagentSpinnerInterval?: ReturnType<typeof setInterval>;
  subagentSpinnerStartedAt?: number;
}

interface SubagentRenderContext {
  state?: SubagentRenderState;
  lastComponent?: unknown;
  invalidate?: () => void;
  isError?: boolean;
}

function compactText(text: unknown, max = MAX_VALUE_PREVIEW): string {
  const singleLine = String(text ?? "").replace(/\s+/g, " ").trim();
  return singleLine.length > max ? `${singleLine.slice(0, max - 1)}…` : singleLine;
}

function titleCase(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function pathDisplay(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized) return "";

  const withoutTrailingSlash = normalized.replace(/\/$/, "");
  const fileName = withoutTrailingSlash.split("/").filter(Boolean).pop();
  return compactText(fileName || withoutTrailingSlash, MAX_VALUE_PREVIEW);
}

function textArg(value: unknown): string {
  return typeof value === "string" ? compactText(value) : "";
}

function currentSpinnerFrame(startedAt: number | undefined): string {
  if (startedAt === undefined) return DEFAULT_SPINNER_FRAME;
  const frame = Math.floor((Date.now() - startedAt) / SPINNER_FRAME_MS) % SPINNER_FRAMES.length;
  return SPINNER_FRAMES[Math.max(0, frame)];
}

function subagentSpinnerFrame(context: SubagentRenderContext | undefined, active: boolean): string {
  const state = context?.state;

  if (!active) {
    if (state?.subagentSpinnerInterval) {
      clearInterval(state.subagentSpinnerInterval);
      state.subagentSpinnerInterval = undefined;
    }
    state && (state.subagentSpinnerStartedAt = undefined);
    return DEFAULT_SPINNER_FRAME;
  }

  if (!state || !context?.invalidate) return DEFAULT_SPINNER_FRAME;

  state.subagentSpinnerStartedAt ??= Date.now();
  state.subagentSpinnerInterval ??= setInterval(() => context.invalidate?.(), SPINNER_FRAME_MS);
  return currentSpinnerFrame(state.subagentSpinnerStartedAt);
}

function statusIcon(status: TranscriptStatus, isPartial: boolean, spinnerIcon = DEFAULT_SPINNER_FRAME): string {
  if (isPartial || status === "running" || status === "starting") return spinnerIcon;
  if (status === "completed") return "✓";
  if (status === "error" || status === "timed_out") return "✕";
  if (status === "aborted") return "!";
  return "•";
}

function toolCallResult(details: SubagentTranscriptDetails, call: Extract<TranscriptEntry, { type: "tool_call" }>) {
  if (!call.toolCallId) return undefined;
  return details.entries.find(
    (entry): entry is Extract<TranscriptEntry, { type: "tool_result" }> =>
      entry.type === "tool_result" && entry.toolCallId === call.toolCallId,
  );
}

function toolCallIcon(
  details: SubagentTranscriptDetails,
  call: Extract<TranscriptEntry, { type: "tool_call" }>,
  spinnerIcon = DEFAULT_SPINNER_FRAME,
): string {
  const result = toolCallResult(details, call);
  if (!result) return details.status === "completed" ? "✓" : spinnerIcon;
  return result.isError ? "✕" : "✓";
}

function latestToolCalls(details: SubagentTranscriptDetails): Array<Extract<TranscriptEntry, { type: "tool_call" }>> {
  return details.entries
    .map((entry, index) => ({ entry, index }))
    .filter((item): item is { entry: Extract<TranscriptEntry, { type: "tool_call" }>; index: number } => item.entry.type === "tool_call")
    .sort((a, b) => b.entry.timestamp - a.entry.timestamp || b.index - a.index)
    .map((item) => item.entry);
}

function summaryLine(details: SubagentTranscriptDetails): string {
  const lines = (details.finalText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
  return compactText(lines[0] ?? "No response yet.", MAX_TASK_PREVIEW);
}

function formatTokenCount(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

export function formatUsageLabel(usage: TranscriptUsage | undefined): string {
  if (!usage) return "";
  const parts = [`↑${formatTokenCount(usage.input)}`, `↓${formatTokenCount(usage.output)}`];
  if (typeof usage.cost === "number") parts.push(`$${usage.cost.toFixed(3)}`);
  return parts.join(" ");
}

function withUsageLabel(text: string, usage: TranscriptUsage | undefined): string {
  const label = formatUsageLabel(usage);
  return label ? `${text} · ${label}` : text;
}

export function formatSubagentCall(tool: SubagentName, task: string): string {
  const preview = compactText(task, MAX_TASK_PREVIEW) || "…";
  return `${titleCase(tool)} Task - ${preview}`;
}

export function renderSubagentCall(
  tool: SubagentName,
  task: string,
  isPartial = true,
  isError = false,
  context?: SubagentRenderContext,
) {
  const spinnerIcon = subagentSpinnerFrame(context, isPartial && !isError);
  const icon = isError ? "✕" : isPartial ? spinnerIcon : "✓";
  const text = context?.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
  text.setText(`${icon} ${formatSubagentCall(tool, task)}`);
  return text;
}

export function formatTranscriptEntry(entry: TranscriptEntry): string {
  switch (entry.type) {
    case "status":
      return `Status - ${compactText(entry.text)}`;
    case "assistant_text":
      return compactText(entry.text, 120);
    case "tool_call": {
      switch (entry.toolName) {
        case "read":
          return `Read ${pathDisplay(entry.args.path ?? entry.args.file_path)}`.trim();
        case "grep": {
          const pattern = textArg(entry.args.pattern);
          const path = pathDisplay(entry.args.path);
          return `Grep ${pattern}${path ? ` in ${path}` : ""}`.trim();
        }
        case "find": {
          const pattern = textArg(entry.args.pattern ?? entry.args.name ?? entry.args.query);
          const path = pathDisplay(entry.args.path);
          return `Find ${pattern}${path ? ` in ${path}` : ""}`.trim();
        }
        case "ls":
          return `Ls ${pathDisplay(entry.args.path)}`.trim();
        case "bash":
          return `Bash ${textArg(entry.args.command)}`.trim();
        case "edit":
          return `Edit ${pathDisplay(entry.args.path ?? entry.args.file_path)}`.trim();
        case "write":
          return `Write ${pathDisplay(entry.args.path ?? entry.args.file_path)}`.trim();
        case "finder":
        case "oracle":
        case "manager":
          return `${titleCase(entry.toolName)} ${textArg(entry.args.query)}`.trim();
        case "worker":
          return `Worker ${textArg(entry.args.task)}`.trim();
        case "handoff_to_worker":
          return `Handoff to Worker ${textArg(entry.args.task)}`.trim();
        default: {
          const task = entry.args.task ?? entry.args.query ?? entry.args.path ?? "";
          return `${titleCase(entry.toolName)} ${textArg(task)}`.trim();
        }
      }
    }
    case "tool_result":
      return entry.text ? compactText(entry.text, 120) : `${titleCase(entry.toolName)} finished`;
  }
}

export function buildCollapsedPreview(
  details: SubagentTranscriptDetails,
  isPartial = false,
  spinnerIcon = DEFAULT_SPINNER_FRAME,
): string {
  const calls = latestToolCalls(details);
  const visible = calls.slice(0, COLLAPSED_TOOL_LIMIT);
  const lines = visible.map((call) => `   ${toolCallIcon(details, call, spinnerIcon)} ${formatTranscriptEntry(call)}`);

  const hidden = calls.length - visible.length;
  if (hidden > 0) {
    lines.push(`   + ${hidden} More (Press Ctrl+O to see)`);
  }

  const usageLabel = formatUsageLabel(details.usage);
  if (usageLabel && lines.length > 0) {
    lines.unshift(`   ${usageLabel}`);
  }

  if (lines.length === 0) {
    const icon = statusIcon(details.status, isPartial, spinnerIcon);
    lines.push(`   ${icon} ${withUsageLabel(isPartial ? "Working…" : summaryLine(details), details.usage)}`);
  }

  return lines.join("\n");
}

export function buildExpandedTranscript(details: SubagentTranscriptDetails, spinnerIcon = DEFAULT_SPINNER_FRAME): string {
  const usageLabel = formatUsageLabel(details.usage);
  const lines = [`Status: ${details.status}${details.model ? ` · ${details.model}` : ""}${usageLabel ? ` · ${usageLabel}` : ""}`];
  const calls = latestToolCalls(details);

  lines.push("", "Tool Calls");
  if (calls.length === 0) {
    lines.push("- None");
  } else {
    lines.push(...calls.map((call) => `- ${toolCallIcon(details, call, spinnerIcon)} ${formatTranscriptEntry(call)}`));
  }

  if ((details.finalText ?? "").trim()) {
    lines.push("", "Response", (details.finalText ?? "").trim());
  }

  return lines.join("\n");
}

export function renderSubagentResult(
  details: SubagentTranscriptDetails,
  expandedOrOptions: boolean | { expanded: boolean; isPartial?: boolean },
  _theme: unknown,
  context?: SubagentRenderContext,
) {
  const expanded = typeof expandedOrOptions === "boolean" ? expandedOrOptions : expandedOrOptions.expanded;
  const isPartial = typeof expandedOrOptions === "boolean" ? false : expandedOrOptions.isPartial;
  const spinnerIcon = subagentSpinnerFrame(context, !!isPartial && !context?.isError);
  const text = context?.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
  text.setText(expanded ? buildExpandedTranscript(details, spinnerIcon) : buildCollapsedPreview(details, isPartial, spinnerIcon));
  return text;
}
