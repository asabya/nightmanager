import { Text } from "@mariozechner/pi-tui";
const COLLAPSED_TOOL_LIMIT = 3;
const MAX_TASK_PREVIEW = 96;
const MAX_VALUE_PREVIEW = 72;
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_FRAME_MS = 100;
const DEFAULT_SPINNER_FRAME = "⠼";
function compactText(text, max = MAX_VALUE_PREVIEW) {
    const singleLine = String(text ?? "").replace(/\s+/g, " ").trim();
    return singleLine.length > max ? `${singleLine.slice(0, max - 1)}…` : singleLine;
}
function titleCase(value) {
    return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
function pathDisplay(value) {
    if (typeof value !== "string")
        return "";
    const normalized = value.trim();
    if (!normalized)
        return "";
    const withoutTrailingSlash = normalized.replace(/\/$/, "");
    const fileName = withoutTrailingSlash.split("/").filter(Boolean).pop();
    return compactText(fileName || withoutTrailingSlash, MAX_VALUE_PREVIEW);
}
function textArg(value) {
    return typeof value === "string" ? compactText(value) : "";
}
function currentSpinnerFrame(startedAt) {
    if (startedAt === undefined)
        return DEFAULT_SPINNER_FRAME;
    const frame = Math.floor((Date.now() - startedAt) / SPINNER_FRAME_MS) % SPINNER_FRAMES.length;
    return SPINNER_FRAMES[Math.max(0, frame)];
}
function subagentSpinnerFrame(context, active) {
    const state = context?.state;
    if (!active) {
        if (state?.subagentSpinnerInterval) {
            clearInterval(state.subagentSpinnerInterval);
            state.subagentSpinnerInterval = undefined;
        }
        state && (state.subagentSpinnerStartedAt = undefined);
        return DEFAULT_SPINNER_FRAME;
    }
    if (!state || !context?.invalidate)
        return DEFAULT_SPINNER_FRAME;
    state.subagentSpinnerStartedAt ??= Date.now();
    state.subagentSpinnerInterval ??= setInterval(() => context.invalidate?.(), SPINNER_FRAME_MS);
    return currentSpinnerFrame(state.subagentSpinnerStartedAt);
}
function statusIcon(status, isPartial, spinnerIcon = DEFAULT_SPINNER_FRAME) {
    if (isPartial || status === "running" || status === "starting")
        return spinnerIcon;
    if (status === "completed")
        return "✓";
    if (status === "error" || status === "timed_out")
        return "✕";
    if (status === "aborted")
        return "!";
    return "•";
}
function toolCallResult(details, call) {
    if (!call.toolCallId)
        return undefined;
    return details.entries.find((entry) => entry.type === "tool_result" && entry.toolCallId === call.toolCallId);
}
function toolCallIcon(details, call, spinnerIcon = DEFAULT_SPINNER_FRAME) {
    const result = toolCallResult(details, call);
    if (!result)
        return details.status === "completed" ? "✓" : spinnerIcon;
    return result.isError ? "✕" : "✓";
}
function latestToolCalls(details) {
    return details.entries
        .map((entry, index) => ({ entry, index }))
        .filter((item) => item.entry.type === "tool_call")
        .sort((a, b) => b.entry.timestamp - a.entry.timestamp || b.index - a.index)
        .map((item) => item.entry);
}
function summaryLine(details) {
    const lines = (details.finalText ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("#"));
    return compactText(lines[0] ?? "No response yet.", MAX_TASK_PREVIEW);
}
export function formatSubagentCall(tool, task) {
    const preview = compactText(task, MAX_TASK_PREVIEW) || "…";
    return `${titleCase(tool)} Task - ${preview}`;
}
export function renderSubagentCall(tool, task, isPartial = true, isError = false, context) {
    const spinnerIcon = subagentSpinnerFrame(context, isPartial && !isError);
    const icon = isError ? "✕" : isPartial ? spinnerIcon : "✓";
    const text = context?.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
    text.setText(`${icon} ${formatSubagentCall(tool, task)}`);
    return text;
}
export function formatTranscriptEntry(entry) {
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
export function buildCollapsedPreview(details, isPartial = false, spinnerIcon = DEFAULT_SPINNER_FRAME) {
    const calls = latestToolCalls(details);
    const visible = calls.slice(0, COLLAPSED_TOOL_LIMIT);
    const lines = visible.map((call) => `   ${toolCallIcon(details, call, spinnerIcon)} ${formatTranscriptEntry(call)}`);
    const hidden = calls.length - visible.length;
    if (hidden > 0) {
        lines.push(`   + ${hidden} More (Press Ctrl+O to see)`);
    }
    if (lines.length === 0) {
        const icon = statusIcon(details.status, isPartial, spinnerIcon);
        lines.push(`   ${icon} ${isPartial ? "Working…" : summaryLine(details)}`);
    }
    return lines.join("\n");
}
export function buildExpandedTranscript(details, spinnerIcon = DEFAULT_SPINNER_FRAME) {
    const lines = [`Status: ${details.status}${details.model ? ` · ${details.model}` : ""}`];
    const calls = latestToolCalls(details);
    lines.push("", "Tool Calls");
    if (calls.length === 0) {
        lines.push("- None");
    }
    else {
        lines.push(...calls.map((call) => `- ${toolCallIcon(details, call, spinnerIcon)} ${formatTranscriptEntry(call)}`));
    }
    if ((details.finalText ?? "").trim()) {
        lines.push("", "Response", (details.finalText ?? "").trim());
    }
    return lines.join("\n");
}
export function renderSubagentResult(details, expandedOrOptions, _theme, context) {
    const expanded = typeof expandedOrOptions === "boolean" ? expandedOrOptions : expandedOrOptions.expanded;
    const isPartial = typeof expandedOrOptions === "boolean" ? false : expandedOrOptions.isPartial;
    const spinnerIcon = subagentSpinnerFrame(context, !!isPartial && !context?.isError);
    const text = context?.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
    text.setText(expanded ? buildExpandedTranscript(details, spinnerIcon) : buildCollapsedPreview(details, isPartial, spinnerIcon));
    return text;
}
//# sourceMappingURL=subagent-rendering.js.map