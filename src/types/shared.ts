export type TaskShape = "search" | "reasoning" | "implementation" | "ambiguous";

/** The subagents the manager can delegate to (everything except the manager itself). */
export const DELEGATE_TOOLS = ["finder", "oracle", "librarian", "worker"] as const;
export type DelegateTool = (typeof DELEGATE_TOOLS)[number];

export function isDelegateTool(name: string): name is DelegateTool {
  return (DELEGATE_TOOLS as readonly string[]).includes(name);
}
