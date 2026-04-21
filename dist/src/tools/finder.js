import { defineTool, createReadTool, createGrepTool, createFindTool, createLsTool, createBashTool, } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { runIsolatedSubagent } from "../core/subagent.js";
const finderSchema = Type.Object({
    query: Type.String({ description: "Natural language search request" }),
});
const FINDER_CONFIG_PATH = join(homedir(), ".pi", "agent", "finder.json");
const FINDER_SYSTEM_PROMPT = `You are Finder, a codebase search specialist. Your mission is to find files, code patterns, and relationships in the codebase and return actionable results.
You answer "where is X?", "which files contain Y?", and "how does Z connect to W?" questions.
You are NOT responsible for modifying code or implementing features.

Read-only: you cannot create, modify, or delete files.
Never use relative paths. Always use absolute paths.
Never store results in files; return them as message text.

## Investigation Protocol
1. Analyze intent: What did they literally ask? What do they actually need?
2. Launch parallel searches on your first action and refine from broad to narrow.
3. Cross-validate findings across multiple tools.
4. Stop when the caller has enough information to proceed.

## Context Budget
- Prefer grep/find over full-file reads.
- For files over 200 lines, use targeted reads with offset/limit.
- Avoid full reads of files over 500 lines unless explicitly requested.

## Output Format
Structure your response EXACTLY as follows.

## Findings
- **Files**: [/absolute/path/file1.ts — why relevant], [/absolute/path/file2.ts — why relevant]
- **Root cause**: [One sentence identifying the core answers]
- **Evidence**: [Key code snippet, pattern, or data point that supports the finding]

## Impact
- **Scope**: single-file | multi-file | cross-module
- **Affected areas**: [List of modules/features that depend on findings]

## Relationships
[How the found files/patterns connect]

## Recommendation
- [Concrete next action]

## Next Steps
- [What agent or action should follow]`;
function resolveFinderModel(ctx) {
    const configured = loadToolConfig(FINDER_CONFIG_PATH)?.model;
    const parsed = configured ? parseModelReference(configured) : null;
    return parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
}
export const finderTool = defineTool({
    name: "finder",
    label: "Finder",
    description: "Launch a specialized search subagent to find files, code patterns, and relationships in the codebase.",
    promptSnippet: "Use finder for complex codebase searches requiring multi-turn exploration across multiple files and patterns.",
    promptGuidelines: [
        "Use finder when a simple grep or find would not be sufficient to understand the codebase structure.",
        "The finder subagent excels at tracing relationships between files, understanding data flows, and finding all usages of a pattern.",
    ],
    parameters: finderSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (!params.query.trim()) {
            return {
                content: [{ type: "text", text: "Error: Please provide a non-empty search query." }],
                details: { error: "empty_query" },
                isError: true,
            };
        }
        const model = resolveFinderModel(ctx);
        if (!model) {
            return {
                content: [{ type: "text", text: "Error: No model available for finder subagent." }],
                details: { error: "no_model", configPath: FINDER_CONFIG_PATH },
                isError: true,
            };
        }
        const text = await runIsolatedSubagent({
            ctx,
            model,
            systemPrompt: FINDER_SYSTEM_PROMPT,
            tools: [
                createReadTool(ctx.cwd),
                createGrepTool(ctx.cwd),
                createFindTool(ctx.cwd),
                createLsTool(ctx.cwd),
                createBashTool(ctx.cwd),
            ],
            task: params.query,
            signal,
            timeoutMs: 180_000,
        });
        return {
            content: [{ type: "text", text }],
            details: { query: params.query },
        };
    },
});
//# sourceMappingURL=finder.js.map