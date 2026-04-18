import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createFindTool, createGrepTool, createLsTool, createReadTool } from "@mariozechner/pi-coding-agent";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { stream, type TextContent } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";

// =========================================================================
// Schema and Types
// =========================================================================

const finderSchema = Type.Object({
  query: Type.String({
    description: "Natural language description of what to find in the codebase. Be specific about file names, patterns, or concepts.",
  }),
});

type FinderInput = Static<typeof finderSchema>;

// =========================================================================
// System Prompt
// =========================================================================

const FINDER_SYSTEM_PROMPT = `You are Finder, a codebase search specialist. Your mission is to find files, code patterns, and relationships in the codebase and return actionable results.
You answer "where is X?", "which files contain Y?", and "how does Z connect to W?" questions.
You are NOT responsible for modifying code or implementing features.

Read-only: you cannot create, modify, or delete files.
Never use relative paths. Always use absolute paths.
Never store results in files; return them as message text.

## Investigation Protocol
1. Analyze intent: What did they literally ask? What do they actually need?
   What result lets the caller proceed immediately?
2. Launch 3+ parallel searches on your first action. Use broad-to-narrow strategy:
   start wide, then refine. Try multiple naming conventions (camelCase, snake_case,
   PascalCase, acronyms).
3. Cross-validate findings across multiple tools (Grep results vs Find results vs Read).
4. Cap exploratory depth: if a search path yields diminishing returns after 2 rounds,
   stop and report what you found.
5. Batch independent queries in parallel. Never run sequential searches when parallel
   is possible.

## Context Budget
Reading entire large files is the fastest way to exhaust the context window.
- Before reading a file, check its size or use grep to find relevant sections first.
- For files >200 lines, read specific sections with offset/limit parameters on Read.
- For files >500 lines, ALWAYS use grep or find first instead of full Read, unless
  the caller specifically asked for full file content.
- When reading large files, set limit: 100 and note "File truncated at 100 lines".
- Batch reads must not exceed 5 files in parallel. Queue additional reads in
   subsequent rounds.
- Prefer structural tools (grep, find) over full reads whenever possible.

## Execution Policy
- Default effort: medium (3-5 parallel searches from different angles).
- Quick lookups: 1-2 targeted searches.
- Thorough investigations: 5-10 searches including alternative naming conventions.
- Stop when you have enough information for the caller to proceed without follow-up
  questions.
- Continue through clear, low-risk search refinements automatically; do not stop at
  a likely first match if the caller still lacks enough context to proceed.

## Output Format
Structure your response EXACTLY as follows. Do not add preamble or meta-commentary.

## Findings
- **Files**: [/absolute/path/file1.ts — why relevant], [/absolute/path/file2.ts — why relevant]
- **Root cause**: [One sentence identifying the core answer]
- **Evidence**: [Key code snippet, pattern, or data point that supports the finding]

## Impact
- **Scope**: single-file | multi-file | cross-module
- **Affected areas**: [List of modules/features that depend on findings]

## Relationships
[How the found files/patterns connect — data flow, dependency chain, or call graph]

## Recommendation
- [Concrete next action for the caller — not "consider" or "you might want to", but "do X"]

## Next Steps
- [What agent or action should follow — "Ready for executor" or "Needs review"]

## Failure Modes to Avoid
- Single search: Running one query and returning. Always launch parallel searches.
- Literal-only answers: Address the underlying need, not just the literal request.
- Relative paths: Any path not starting with / is a failure.
- Tunnel vision: Searching only one naming convention. Try all variants.
- Unbounded exploration: Cap depth at 2 rounds of diminishing returns.
- Reading entire large files: Always check size first, use targeted reads.

## Final Checklist
- Are all paths absolute?
- Did I find all relevant matches (not just first)?
- Did I explain relationships between findings?
- Can the caller proceed without follow-up questions?
- Did I address the underlying need?`;

// =========================================================================
// Finder Tool
// =========================================================================

export default function finderExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "finder",
    label: "Finder",
    description: "Launch a specialized search subagent to find files, code patterns, and relationships in the codebase. The subagent uses parallel search strategies and returns structured findings.",
    promptSnippet: "Use finder for complex codebase searches requiring multi-turn exploration across multiple files and patterns.",
    promptGuidelines: [
      "Use finder when a simple grep or find would not be sufficient to understand the codebase structure.",
      "The finder subagent excels at tracing relationships between files, understanding data flows, and finding all usages of a pattern.",
    ],
    parameters: finderSchema,
    async execute(toolCallId: string, params: FinderInput, signal: AbortSignal | undefined, _onUpdate, ctx: ExtensionContext) {
      // Validate query
      if (!params.query || params.query.trim().length === 0) {
        return {
          content: [{ type: "text", text: "Error: Please provide a non-empty search query." }],
          details: { error: "empty_query" },
        };
      }

      // Build read-only tools for the subagent
      const subagentTools: AgentTool[] = [
        createReadTool(ctx.cwd),
        createGrepTool(ctx.cwd),
        createFindTool(ctx.cwd),
        createLsTool(ctx.cwd),
      ];

      // Use the same model as the main session
      const model = ctx.model;
      if (!model) {
        return {
          content: [{ type: "text", text: "Error: No model available for finder subagent. Please set a model first." }],
          details: { error: "no_model" },
        };
      }

      const subagentSignal = signal ? AbortSignal.any([signal]) : undefined;
      const timeoutAbort = new AbortController();

      // 60-second timeout
      const timeoutId = setTimeout(() => timeoutAbort.abort(), 60_000);
      const combinedSignal = subagentSignal
        ? AbortSignal.any([subagentSignal, timeoutAbort.signal])
        : timeoutAbort.signal;

      // Create the subagent Agent instance with isolated context
      const agent = new Agent({
        initialState: {
          systemPrompt: FINDER_SYSTEM_PROMPT,
          model,
          tools: subagentTools,
        },
        streamFn: (m, c, opts) => stream(m, c, { ...opts, signal: combinedSignal }),
      });

      // Track files discovered for diminishing returns detection
      const discoveredFiles = new Set<string>();
      let consecutiveTurnsWithNoNewFiles = 0;
      let turnCount = 0;
      const MAX_TURNS = 10;

      // Subscribe to track turns and detect diminishing returns
      agent.subscribe((event) => {
        if (event.type === "turn_end") {
          turnCount++;

          // Check for new files in tool results
          let foundNewFiles = false;
          for (const toolResult of event.toolResults) {
            const content = toolResult.content || [];
            for (const block of content) {
              if (block.type === "text" && block.text) {
                // Extract file paths from tool results (lines starting with /)
                const lines = block.text.split("\n");
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith("/")) {
                    const filePath = trimmed.split(":")[0].split(" ")[0];
                    if (!discoveredFiles.has(filePath)) {
                      discoveredFiles.add(filePath);
                      foundNewFiles = true;
                    }
                  }
                }
              }
            }
          }

          if (!foundNewFiles && turnCount > 1) {
            consecutiveTurnsWithNoNewFiles++;
          } else {
            consecutiveTurnsWithNoNewFiles = 0;
          }

          // If diminishing returns detected, force summary
          if (consecutiveTurnsWithNoNewFiles >= 2) {
            agent.steer({
              role: "user",
              content: [{ type: "text", text: "You have sufficient context. No new files were found in the last 2 rounds. Summarize all your findings now using the required output format. Do not make more tool calls." }],
              timestamp: Date.now(),
            });
          }

          // If max turns reached, force summary
          if (turnCount >= MAX_TURNS) {
            agent.steer({
              role: "user",
              content: [{ type: "text", text: "Maximum search turns reached. Summarize all your findings now using the required output format." }],
              timestamp: Date.now(),
            });
          }
        }
      });

      // Send the search query
      await agent.prompt(params.query);

      // Wait for the agent to finish
      await agent.waitForIdle();

      // Clean up timeout
      clearTimeout(timeoutId);

      // Extract result from agent state
      const messages = agent.state.messages;
      const lastAssistantMsg = messages
        .filter((m): m is Extract<typeof m, { role: "assistant" }> => m.role === "assistant")
        .pop();

      if (!lastAssistantMsg) {
        const isTimeout = timeoutAbort.signal.aborted && !signal?.aborted;
        const timeoutNote = isTimeout ? "\n\n(Search timed out after 60s — partial results)" : "";
        const partialFindings = discoveredFiles.size > 0
          ? `Found ${discoveredFiles.size} files: ${[...discoveredFiles].slice(0, 10).join(", ")}${discoveredFiles.size > 10 ? "..." : ""}`
          : "No files were found before the search ended.";

        return {
          content: [{ type: "text", text: `Error: Finder subagent did not return a response.${timeoutNote}\n\n${partialFindings}` }],
          details: { error: "no_response", turns: turnCount, filesFound: discoveredFiles.size, timedOut: isTimeout },
        };
      }

      // Extract text content
      const textParts = lastAssistantMsg.content.filter((c): c is TextContent => c.type === "text");
      const text = textParts.map(c => c.text).join("\n").trim();

      const isTimeout = timeoutAbort.signal.aborted && !signal?.aborted;
      const timeoutNote = isTimeout ? "\n\n(Search timed out after 60s — results may be partial)" : "";

      return {
        content: [{ type: "text", text: text + timeoutNote }],
        details: {
          turns: turnCount,
          filesFound: discoveredFiles.size,
          model: `${model.provider}/${model.id}`,
          timedOut: isTimeout,
        },
      };
    },

    renderCall(args: FinderInput, theme: any) {
      const query = args.query || "";
      const truncated = query.length > 80 ? query.slice(0, 80) + "..." : query;
      return new Text(
        `${theme.fg("toolTitle", theme.bold("finder"))} ${theme.fg("accent", `"${truncated}"`)}`,
        0, 0
      );
    },

    renderResult(result: any, { expanded }: { expanded: boolean }, theme: any) {
      if (!expanded) {
        const details = result.details || {};
        const summary = details.filesFound
          ? ` → ${details.filesFound} files found in ${details.turns} turns`
          : "";
        return new Text(summary, 0, 0);
      }

      const textContent = result.content?.find((c: any) => c.type === "text");
      if (!textContent?.text) return new Text("", 0, 0);

      const output = textContent.text
        .split("\n")
        .map((line: string) => theme.fg("toolOutput", line))
        .join("\n");

      return new Text(`\n${output}`, 0, 0);
    },
  });
}
