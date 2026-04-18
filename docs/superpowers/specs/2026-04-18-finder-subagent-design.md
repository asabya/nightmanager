# Finder Subagent for Pi — Design Specification

**Date:** 2026-04-18  
**Author:** Sabyasachi Patra  
**Status:** Proposed

## Overview

A `finder` custom tool for the pi CLI agent that spawns a true subagent session with its own context window, model, and restricted tool set. The subagent performs multi-turn codebase exploration using parallel search strategies and returns structured findings to the main agent.

This serves as a hands-on research platform for understanding subagent orchestration patterns without building an orchestrator from scratch.

## Architecture & Components

### 1. The `finder` Tool Definition
- Registered via `pi.registerTool()`
- Parameters: `{ query: string }` — natural language search intent
- When executed, spawns a subagent session inside the `execute()` function
- Visible to the main agent as a single tool call; subagent internals are invisible

### 2. The Subagent Session
- Created via `createAgentSession()` from pi's SDK
- **Model:** Configurable, defaults to a fast/cheap model (e.g., Gemini Flash or equivalent)
- **Tools:** Restricted to read-only: `read`, `grep`, `find`, `ls` — no `bash`, `edit`, `write`
- **System prompt:** Custom prompt tuned for codebase exploration (see System Prompt section)
- **Context window:** Fully isolated from the main agent

### 3. The Mini Agent Loop Driver
Inside the tool's `execute()` function, a loop that:
1. Sends the current messages (starting with the search query) to the subagent model via the pi-ai API
2. Parses the response — if it contains tool calls, executes them using pi's built-in tool implementations
3. Executes multiple tool calls **in parallel** within a single turn
4. Appends tool results and feeds back into the loop
5. Continues until:
   - The model returns a final text answer (no tool calls)
   - A max-turn limit is hit (default: 10)
   - A timeout is exceeded (default: 60 seconds)
6. The final text answer becomes the tool result returned to the main agent

### 4. Main Agent ↔ Subagent Communication
- The main agent calls `finder(query: "find the auth middleware that validates JWT tokens")`
- The subagent runs silently — its intermediate tool calls are invisible to the main agent
- Only the final structured summary is returned

## System Prompt

The subagent receives this system prompt:

```
You are Finder, a codebase search specialist. Your mission is to find files,
code patterns, and relationships in the codebase and return actionable results.
You answer "where is X?", "which files contain Y?", and "how does Z connect to W?"
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
- Did I address the underlying need?
```

## Data Flow

```
Main Agent: "I need to find the auth middleware"
  → calls finder(query: "find the auth middleware that validates JWT tokens")
    → Tool execute() starts:
      1. Create subagent session (separate context, restricted tools, fast model)
      2. Build messages: [system_prompt, user_message(query)]
      3. Turn 1: Call subagent model → parse response
         → 4 parallel tool calls: grep("auth"), find("*middleware*"),
           grep("jwt|token|bearer"), find("*auth*")
         → Execute all 4 in parallel → append results
      4. Turn 2: Call subagent model → parse response
         → 3 tool calls: read(auth.ts, limit:100), grep("validateToken"),
           find("*jwt*")
         → Execute in parallel → append results
      5. Loop continues until model returns text-only response or turn limit hit
      6. Return final response as tool result
    → Main agent receives structured findings and continues
```

## State Management

- **Subagent lifecycle:** The subagent session exists only during the `execute()` call. When the tool finishes, the session is discarded — no persistence needed.
- **Turn tracking:** Simple counter. Hard limit at 10 turns prevents runaway searches.
- **Context monitoring:** Before each turn, check `getContextUsage()` on the subagent session. If >80% full, inject a message: "Context window is nearly full. Summarize all findings now. Do not make more tool calls."
- **Tool execution:** The subagent's tool calls reuse pi's existing tool implementations (`createGrepTool`, `createFindTool`, `createLsTool`, `createReadTool`) — called directly via `.execute()`, not through pi's LLM tool-calling mechanism.
- **Diminishing returns detection (automatic):** The loop driver tracks unique files discovered across turns. If 2 consecutive turns yield 0 new files from tool results, inject: "You have sufficient context. Summarize your findings now."
- **File tracking:** Track set of unique file paths seen in tool results across all turns.

## Error Handling

| Scenario | Handling |
|----------|----------|
| Model call fails | Retry once. If still fails, return structured error message |
| Tool execution error | Feed error as tool result back to subagent. After 3 consecutive errors, force summarization |
| Turn limit hit (10) | Force summarization: inject "Summarize all findings now" |
| Timeout (60s) | Return accumulated findings with "Search timed out after X turns, partial results" |
| Empty query | Reject before spawning subagent: "Please provide a search query" |
| Empty results | Return structured "No relevant files found" with alternative search suggestions |
| Context window >80% | Force summarization directive |
| Subagent loops (re-grepping same thing) | Handled by diminishing returns detector |

## Safety Boundaries

- Subagent gets only `read`, `grep`, `find`, `ls` tools — no `bash`, `edit`, `write`
- File reads capped at pi's built-in truncation (50KB per read)
- Subagent cannot access filesystem outside the workspace `cwd`
- Max 10 turns, 60-second timeout
- Max 5 parallel reads per turn

## Extension Location

The finder extension will be placed at:
- `~/.pi/agent/extensions/finder.ts` (global) or
- `.pi/extensions/finder.ts` (project-local)

## Future Extensions

- Add LSP-based tools (`document_symbols`, `workspace_symbols`) for semantic search
- Add AST search capabilities for structural pattern matching
- Make the model configurable per-invocation
- Support multi-query mode (e.g., `finder` that can handle multiple independent searches)
