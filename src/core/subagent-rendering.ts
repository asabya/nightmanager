import { Text } from "@mariozechner/pi-tui";
import type { SubagentTranscriptDetails, TranscriptEntry } from "./transcript.js";

function previewText(text: string, max = 80): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > max ? `${singleLine.slice(0, max - 3)}...` : singleLine;
}

export function formatTranscriptEntry(entry: TranscriptEntry): string {
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

function summaryLine(details: SubagentTranscriptDetails): string {
  const lines = (details.finalText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
  return lines[0] ?? "(no summary)";
}

export function buildCollapsedPreview(details: SubagentTranscriptDetails): string {
  const previewEntries = details.entries.slice(-4).map(formatTranscriptEntry);
  const preview = previewEntries.length > 0 ? `\n${previewEntries.join("\n")}` : "";
  return `${details.tool} - ${summaryLine(details)}${preview}\nCtrl+O to expand`;
}

export function buildExpandedTranscript(details: SubagentTranscriptDetails): string {
  const lines = [`${details.tool} - ${details.task}`];
  if (details.entries.length > 0) {
    lines.push(...details.entries.map(formatTranscriptEntry));
  }
  if ((details.finalText ?? "").trim()) {
    lines.push("", (details.finalText ?? "").trim());
  }
  return lines.join("\n");
}

export function renderSubagentResult(details: SubagentTranscriptDetails, expanded: boolean, _theme: unknown) {
  return new Text(expanded ? buildExpandedTranscript(details) : buildCollapsedPreview(details), 0, 0);
}
