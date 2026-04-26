import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  defineTool,
  createReadTool,
  createGrepTool,
  createFindTool,
  createLsTool,
  createBashTool,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";
import { Text } from "@mariozechner/pi-tui";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { LEAN_RESPONSE_INSTRUCTIONS } from "../core/prompts.js";
import { renderSubagentCall, renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";

const finderSchema = Type.Object({
  query: Type.String({ description: "Natural language search request" }),
});

type FinderInput = Static<typeof finderSchema>;

const FINDER_CONFIG_PATH = join(homedir(), ".pi", "agent", "finder.json");

const FINDER_SYSTEM_PROMPT = `You are Finder, a codebase search specialist.
Find files, code patterns, and relationships; do not modify files.
Answer “where is X?”, “which files contain Y?”, and “how does Z connect to W?” questions.

Read-only: you cannot create, modify, or delete files.
Never use relative paths in final answers. Always use absolute paths.
Never store results in files; return them as message text.

## Investigation Protocol
1. Search broadly first, then narrow.
2. Cross-check important findings with a second signal.
3. Read only the file ranges needed to answer.
4. Stop once the caller has enough evidence to proceed.

## Context Budget
- Prefer grep/find over full-file reads.
- For files over 200 lines, use targeted reads with offset/limit.
- Avoid full reads of files over 500 lines unless explicitly requested.

${LEAN_RESPONSE_INSTRUCTIONS}

## Final Response Format
Summary: one sentence answering the task.
Target files: primary files a later worker should inspect/edit, or None.
Evidence:
- /absolute/path/file:line — decisive detail.
Relationships: one short sentence, or None.
Implementation handoff: concise context, related files, and caveats for a later worker, or None.
Next: one concrete next step.`;

function resolveFinderModel(ctx: ExtensionContext) {
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
  renderCall(args, _theme, context) {
    return renderSubagentCall("finder", args.query ?? "", context.isPartial, context.isError, context);
  },
  renderResult(result, options, theme, context) {
    const transcript = (result.details as { transcript?: unknown } | undefined)?.transcript;
    if (transcript) return renderSubagentResult(transcript as any, options, theme, context);
    const text = result.content[0];
    return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
  },
  async execute(_toolCallId, params: FinderInput, signal, _onUpdate, ctx) {
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

    const result = await runIsolatedSubagent({
      subagentName: "finder",
      onUpdate: (partial) => {
        _onUpdate?.({
          content: partial.content,
          details: { query: params.query, transcript: partial.details },
        });
      },
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
      content: [{ type: "text", text: result.finalText }],
      details: { query: params.query, transcript: result.details },
    };
  },
});
