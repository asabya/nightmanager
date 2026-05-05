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
import { Text } from "@mariozechner/pi-tui";
import { resolveSubagentConfig } from "../core/models.js";
import { LEAN_RESPONSE_INSTRUCTIONS } from "../core/prompts.js";
import { renderSubagentCall, renderSubagentResult } from "../core/subagent-rendering.js";
import { runIsolatedSubagent } from "../core/subagent.js";

const finderSchema = Type.Object({
  query: Type.String({ description: "Natural language search request" }),
});

type FinderInput = Static<typeof finderSchema>;

const FINDER_SYSTEM_PROMPT = `You are Finder, a read-only codebase search specialist.
Find files, patterns, and relationships; never modify or write files. Final local paths must be absolute.
Method: search broadly, narrow, cross-check key claims, read only needed ranges, and stop when enough evidence exists. Prefer grep/find; avoid full large-file reads.

${LEAN_RESPONSE_INSTRUCTIONS}

Final format:
Summary: one sentence.
Target files: paths for a later worker, or None.
Evidence: /absolute/path:line — decisive detail.
Relationships: one sentence, or None.
Implementation handoff: context/caveats, or None.
Next: one step.`;

export const finderTool = defineTool({
  name: "finder",
  label: "Finder",
  description: "Launch a specialized search subagent to find files, code patterns, and relationships in the codebase.",
  promptSnippet: "Use finder for multi-file codebase discovery and relationship tracing.",
  promptGuidelines: [
    "Use finder when direct grep/find is not enough.",
    "Finder returns read-only file/location evidence and worker handoff context.",
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

    const subagentConfig = resolveSubagentConfig(ctx, "finder");
    const model = subagentConfig.model;
    if (!model) {
      return {
        content: [{ type: "text", text: "Error: No model available for finder subagent." }],
        details: { error: "no_model", configPath: subagentConfig.configPath },
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
      thinkingLevel: subagentConfig.thinkingLevel,
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
