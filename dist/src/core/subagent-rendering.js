import { Text } from "@mariozechner/pi-tui";
function previewText(text, max = 80) {
    const singleLine = text.replace(/\s+/g, " ").trim();
    return singleLine.length > max ? `${singleLine.slice(0, max - 3)}...` : singleLine;
}
export function formatTranscriptEntry(entry) {
    switch (entry.type) {
        case "status":
            return `Status - ${entry.text}`;
        case "assistant_text":
            return entry.text;
        case "tool_call": {
            switch (entry.toolName) {
                case "read":
                    return `Read ${String(entry.args.path ?? entry.args.file_path ?? "")}`.trim();
                case "grep":
                    return `Grep ${String(entry.args.pattern ?? "")}${entry.args.path ? ` in ${String(entry.args.path)}` : ""}`.trim();
                case "find":
                    return `Find ${String(entry.args.pattern ?? "")}${entry.args.path ? ` in ${String(entry.args.path)}` : ""}`.trim();
                case "bash":
                    return `Bash ${String(entry.args.command ?? "")}`.trim();
                case "edit":
                    return `Edit ${String(entry.args.path ?? entry.args.file_path ?? "")}`.trim();
                case "write":
                    return `Write ${String(entry.args.path ?? entry.args.file_path ?? "")}`.trim();
                default: {
                    const task = entry.args.task ?? entry.args.query ?? "";
                    return `${entry.toolName} ${String(task)}`.trim();
                }
            }
        }
        case "tool_result":
            return entry.text ? previewText(entry.text, 120) : `${entry.toolName} finished`;
    }
}
function summaryLine(details) {
    const lines = (details.finalText ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("#"));
    return lines[0] ?? "(no summary)";
}
export function buildCollapsedPreview(details) {
    const previewEntries = details.entries.slice(-4).map(formatTranscriptEntry);
    const preview = previewEntries.length > 0 ? `\n${previewEntries.join("\n")}` : "";
    return `${details.tool} - ${summaryLine(details)}${preview}\nCtrl+O to expand`;
}
export function buildExpandedTranscript(details) {
    const lines = [`${details.tool} - ${details.task}`];
    if (details.entries.length > 0) {
        lines.push(...details.entries.map(formatTranscriptEntry));
    }
    if ((details.finalText ?? "").trim()) {
        lines.push("", (details.finalText ?? "").trim());
    }
    return lines.join("\n");
}
export function renderSubagentResult(details, expanded, _theme) {
    return new Text(expanded ? buildExpandedTranscript(details) : buildCollapsedPreview(details), 0, 0);
}
//# sourceMappingURL=subagent-rendering.js.map