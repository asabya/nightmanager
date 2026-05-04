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
import { researchCodeSearchTool, researchWebSearchTool } from "./oracle.js";

const librarianSchema = Type.Object({
  query: Type.String({ description: "Open-source library or upstream repository research request" }),
});

type LibrarianInput = Static<typeof librarianSchema>;

export const LIBRARIAN_SYSTEM_PROMPT = `You are Librarian, a read-only research specialist for external open-source codebases.
Answer library, framework, SDK, and upstream repository questions with evidence rather than guesses.
You are not responsible for implementing changes or editing files.

Read-only: do not create, modify, or delete files in the user's repository. You may clone public upstream repositories into /tmp for inspection when needed. Never write findings into files; return them as message text.
Never use relative paths in final answers. Use absolute local paths for /tmp clones and strict GitHub permalinks for source-code claims.

## Research Tools
- Use web_search for canonical upstream repository discovery, official docs, release notes, and current external facts.
- Use code_search for public code examples, API usage patterns, tests, and documentation snippets.
- Search GitHub for the canonical upstream repository when the user names only a package or library.
- If upstream identification is ambiguous, state the ambiguity and stop instead of guessing.

## Evidence Policy
1. Prefer upstream source code first.
2. Inspect tests and examples before README or docs.
3. Use production source when tests/examples are insufficient.
4. Treat source code as authoritative over docs when they conflict.
5. Consult official docs only when source-code evidence is insufficient or unavailable.
6. Back factual source-code claims with strict GitHub permalinks; include direct quotes/snippets when available.

## Repository Handling
- If the user names one or more GitHub repos, clone them into /tmp and inspect local clones.
- Prefer the latest default branch HEAD unless the user specifies a version; when specified, prefer that version.
- For comparisons, handle 2-3 repos by default, 4-5 when user-provided, and split 6+ repos into batches.
- Rank findings by API correctness, closest match to the question, current implementation, and best documented example.

${LEAN_RESPONSE_INSTRUCTIONS}

## Final Response Format
Summary: one sentence answer.
Evidence:
- strict GitHub permalink, /absolute/tmp/path, or official URL — decisive detail.
Findings: ranked bullets, comparison table, side-by-side summary, or another format suited to the question.
Uncertainty: weak or ambiguous evidence, or None.
Next: one concrete follow-up, or None.`;

export const librarianTool = defineTool({
  name: "librarian",
  label: "Librarian",
  description: "Launch a read-only research subagent for evidence-backed open-source library and upstream repository analysis.",
  promptSnippet: "Use librarian for OSS/library research that needs canonical repo discovery, code-first evidence, and GitHub permalinks.",
  promptGuidelines: [
    "Use librarian for questions about external libraries, SDKs, frameworks, and upstream GitHub repositories.",
    "The librarian subagent prioritizes tests/examples/source over docs and uses web_search and code_search for research.",
  ],
  parameters: librarianSchema,
  renderCall(args, _theme, context) {
    return renderSubagentCall("librarian", args.query ?? "", context.isPartial, context.isError, context);
  },
  renderResult(result, options, theme, context) {
    const transcript = (result.details as { transcript?: unknown } | undefined)?.transcript;
    if (transcript) return renderSubagentResult(transcript as any, options, theme, context);
    const text = result.content[0];
    return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
  },
  async execute(_toolCallId, params: LibrarianInput, signal, _onUpdate, ctx) {
    if (!params.query.trim()) {
      return {
        content: [{ type: "text", text: "Error: Please provide a non-empty research query." }],
        details: { error: "empty_query" },
        isError: true,
      };
    }

    const subagentConfig = resolveSubagentConfig(ctx, "librarian");
    const model = subagentConfig.model;
    if (!model) {
      return {
        content: [{ type: "text", text: "Error: No model available for librarian subagent." }],
        details: { error: "no_model", configPath: subagentConfig.configPath },
        isError: true,
      };
    }

    const result = await runIsolatedSubagent({
      subagentName: "librarian",
      onUpdate: (partial) => {
        _onUpdate?.({
          content: partial.content,
          details: { query: params.query, transcript: partial.details },
        });
      },
      ctx,
      model,
      thinkingLevel: subagentConfig.thinkingLevel,
      systemPrompt: LIBRARIAN_SYSTEM_PROMPT,
      tools: [
        createReadTool(ctx.cwd),
        createGrepTool(ctx.cwd),
        createFindTool(ctx.cwd),
        createLsTool(ctx.cwd),
        createBashTool(ctx.cwd),
        researchWebSearchTool,
        researchCodeSearchTool,
      ],
      task: params.query,
      signal,
      timeoutMs: 300_000,
    });

    return {
      content: [{ type: "text", text: result.finalText }],
      details: { query: params.query, transcript: result.details },
    };
  },
});
