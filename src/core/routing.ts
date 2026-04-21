import type { DelegateTool, TaskShape } from "../types/shared.js";

const SEARCH_RE = /\b(find|where|locate|search|trace)\b/i;
const REASONING_RE = /\b(debug|why|reason|root cause|trade-?off|hypothesis|plan the safest)\b/i;
const IMPLEMENTATION_RE = /\b(implement|add|change|edit|update|fix|refactor|write)\b/i;

export function classifyTaskShape(input: string): TaskShape {
  const text = input.trim();
  if (text.length === 0) return "ambiguous";
  if (SEARCH_RE.test(text)) return "search";
  if (REASONING_RE.test(text)) return "reasoning";
  if (IMPLEMENTATION_RE.test(text)) return "implementation";
  return "ambiguous";
}

export function chooseDelegate(shape: Exclude<TaskShape, "ambiguous">): DelegateTool {
  if (shape === "search") return "finder";
  if (shape === "reasoning") return "oracle";
  return "worker";
}
