/**
 * Oracle Subagent Extension for Pi
 *
 * Registers an `oracle` tool that spawns a dedicated reasoning subagent with:
 * - Its own context window (isolated from the main agent)
 * - Configurable model via ~/.pi/agent/oracle.json
 * - Read-heavy evidence gathering tools plus bash for safe verification commands
 * - A reasoning-focused system prompt for debugging tricky problems and planning nuanced changes
 * - Automatic turn limiting and forced synthesis when evidence plateaus
 * - Inline progress display via onUpdate streaming
 *
 * Usage:
 *   pi -e ./oracle.ts
 *   Then: "Use oracle to debug why auth middleware fails intermittently"
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createFindTool, createGrepTool, createLsTool, createReadTool, createBashTool } from "@mariozechner/pi-coding-agent";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { stream, type Model, type TextContent } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";
import { Text, truncateToWidth, Loader, type TUI, type Component } from "@mariozechner/pi-tui";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// =========================================================================
// Progress Widget (embedded for single-file deployment)
// =========================================================================

/**
 * Multi-line progress indicator for finder subagent searches.
 * Shows main task line + running tools (up to 5) with independent animated loaders.
 */
interface FinderToolEntry {
	id: string;
	toolName: string;
	label: string;
	status: "running" | "done";
	sequence: number;
	doneAt?: number;
	loader?: Loader;
}

function toTitleCase(value: string): string {
	return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

class FinderProgress implements Component {
	private tui: TUI;
	private theme: { fg: (color: string, text: string) => string };
	private query: string;
	private mainLoader: Loader;
	private toolEntries: FinderToolEntry[];
	private maxToolLines: number;
	private nextToolSequence: number;

	constructor(
		tui: TUI,
		theme: { fg: (color: string, text: string) => string },
		query: string,
	) {
		this.tui = tui;
		this.theme = theme;
		this.query = query;
		// Expected widget behavior:
		// 1. tool_execution_start adds a visible running row: "Tool N <toolName>"
		// 2. turn_end does not clear history; it marks running rows done
		// 3. render() shows running rows first, then recent completed rows
		// 4. render() shows at most 5 tool rows plus optional "+ N more"
		this.toolEntries = [];
		this.maxToolLines = 5;
		this.nextToolSequence = 1;

		this.mainLoader = new Loader(
			tui,
			theme.fg.bind(theme, "accent"),
			theme.fg.bind(theme, "muted"),
			`Finder Task - ${query}`,
		);
	}

	addTool(toolName: string, label: string): void {
		const sequence = this.nextToolSequence++;
		const entry: FinderToolEntry = {
			id: `${sequence}:${toolName}`,
			toolName,
			label,
			status: "running",
			sequence,
			loader: new Loader(
				this.tui,
				this.theme.fg.bind(this.theme, "accent"),
				this.theme.fg.bind(this.theme, "dim"),
				label,
			),
		};

		this.toolEntries.push(entry);
		this.tui.requestRender();
	}

	markRunningToolsDone(): void {
		const now = Date.now();
		let changed = false;

		for (const entry of this.toolEntries) {
			if (entry.status !== "running") continue;
			entry.status = "done";
			entry.doneAt = now;
			entry.loader?.stop();
			entry.loader = undefined;
			changed = true;
		}

		if (changed) {
			this.tui.requestRender();
		}
	}

	clearTools(): void {
		for (const entry of this.toolEntries) {
			entry.loader?.stop();
		}
		this.toolEntries = [];
	}

	dispose(): void {
		this.mainLoader.stop();
		this.clearTools();
	}

	// Render order:
	// - main finder task line
	// - running tools in sequence order (newer running tools below older ones)
	// - completed tools at the bottom with a done indicator
	// - overflow line when more than maxToolLines exist
	render(width: number): string[] {
		const lines: string[] = [];
		const mainLines = this.mainLoader.render(width);
		lines.push(mainLines[1] || "");

		const running = this.toolEntries
			.filter((entry) => entry.status === "running")
			.sort((a, b) => a.sequence - b.sequence);
		const completed = this.toolEntries
			.filter((entry) => entry.status === "done")
			.sort((a, b) => a.sequence - b.sequence);
		const orderedEntries = [...running, ...completed];
		const visibleEntries = orderedEntries.slice(0, this.maxToolLines);
		const hiddenCount = Math.max(0, orderedEntries.length - visibleEntries.length);

		for (const entry of visibleEntries) {
			if (entry.status === "running" && entry.loader) {
				const toolLines = entry.loader.render(width - 3);
				const toolLine = toolLines[1] || this.theme.fg("accent", `⠼ ${entry.label}`);
				lines.push(`   ${toolLine}`);
			} else {
				lines.push(`   ${this.theme.fg("dim", `✓ ${entry.label}`)}`);
			}
		}

		if (hiddenCount > 0) {
			lines.push(`   ${this.theme.fg("dim", `+ ${hiddenCount} more`)}`);
		}

		return lines;
	}

	invalidate(): void {
		this.mainLoader.invalidate();
		for (const entry of this.toolEntries) {
			entry.loader?.invalidate();
		}
	}
}

// Progress widget reference for updates during search
let finderProgress: FinderProgress | null = null;

// =========================================================================
// Schema and Types
// =========================================================================

const oracleSchema = Type.Object({
  query: Type.String({
    description: "Natural language description of the problem to reason about. Include the bug, behavior, trade-off, or planning question the Oracle should analyze.",
  }),
});

type OracleInput = Static<typeof oracleSchema>;

type OracleStatus = "initializing" | "investigating" | "reasoning" | "synthesizing" | "complete" | "error";

interface ToolCallRecord {
  tool: string;
  input: string;
}

interface OracleDetails {
  query: string;
  status: OracleStatus;
  model: string;
  turnCount: number;
  maxTurns: number;
  evidenceCount: number;
  toolCalls: ToolCallRecord[];
  error?: string;
  evidenceSources?: string[];
  timedOut?: boolean;
}

// =========================================================================
// Config loading — simple model reference only
// =========================================================================

interface OracleConfig {
  model: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "oracle.json");

function loadOracleModelReference(): string | null {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed: OracleConfig = JSON.parse(raw);
    if (!parsed.model) {
      return null;
    }
    return parsed.model;
  } catch {
    return null;
  }
}

// =========================================================================
// Model resolution (lazy — uses modelRegistry from context)
// =========================================================================

let cachedOracleModel: Model<any> | null = null;

function resolveOracleModel(modelRegistry: any): Model<any> | null {
  if (cachedOracleModel) return cachedOracleModel;

  const modelRef = loadOracleModelReference();
  if (!modelRef) {
    return null;
  }

  const parts = modelRef.split("/");
  if (parts.length < 2) {
    return null;
  }

  const [provider, modelId] = parts;
  if (!provider || !modelId) {
    return null;
  }

  const model = modelRegistry.find(provider, modelId);
  if (!model) {
    return null;
  }

  cachedOracleModel = model as Model<any>;
  return cachedOracleModel;
}

// =========================================================================
// System Prompt
// =========================================================================

const ORACLE_SYSTEM_PROMPT = `You are Finder, a codebase search specialist. Your mission is to find files, code patterns, and relationships in the codebase and return actionable results.
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
- **Root cause**: [One sentence identifying the core answers]
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
// Helper functions
// =========================================================================

function formatToolInput(tool: string, input: unknown): string {
  const inputStr = typeof input === "string" ? input : JSON.stringify(input);
  const truncated = inputStr.length > 50 ? inputStr.slice(0, 50) + "..." : inputStr;
  
  // Shorten paths for display
  const shortened = truncated.replace(process.env.HOME || "/home", "~");
  return shortened;
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

function summarizeToolLabel(tool: string, input: unknown): string {
  const args = input && typeof input === "object" ? input as Record<string, unknown> : undefined;

  if (tool === "read") {
    const path = typeof args?.path === "string" ? args.path : undefined;
    return path ? `Read ${basename(path)}` : "Read file";
  }

  if (tool === "find") {
    const path = typeof args?.path === "string" ? args.path : undefined;
    const pattern = typeof args?.pattern === "string" ? args.pattern : undefined;
    const target = pattern || path;
    return target ? `Find ${basename(target)}` : "Find files";
  }

  if (tool === "grep") {
    const pattern = typeof args?.pattern === "string" ? args.pattern : undefined;
    return pattern ? `Grep ${pattern}` : "Grep";
  }

  if (tool === "ls") {
    const path = typeof args?.path === "string" ? args.path : undefined;
    return path ? `List ${basename(path)}` : "List files";
  }

  if (tool === "bash") {
    const command = typeof args?.command === "string" ? args.command : typeof input === "string" ? input : undefined;
    if (!command) return "Bash";
    const compact = command.length > 40 ? `${command.slice(0, 40)}...` : command;
    return `Bash ${compact}`;
  }

  const fallback = formatToolInput(tool, input);
  return fallback && fallback !== "{}"
    ? `${toTitleCase(tool)} ${fallback}`
    : toTitleCase(tool);
}

// =========================================================================
// Finder Tool
// =========================================================================

export default function oracleExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "oracle",
    label: "Oracle",
    description: "Launch a deep-reasoning subagent for debugging tricky problems, ranking competing hypotheses, and planning nuanced changes.",
    promptSnippet: "Use oracle when you need deep reasoning for debugging, root-cause analysis, or trade-off-aware planning.",
    promptGuidelines: [
      "Use oracle when the main agent is stuck between multiple explanations and needs evidence-backed reasoning.",
      "The oracle subagent excels at debugging tricky failures, ranking hypotheses, and recommending the best next probe.",
    ],
    parameters: oracleSchema,
    async execute(toolCallId: string, params: OracleInput, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined, ctx: ExtensionContext) {
      // Validate query
      if (!params.query || params.query.trim().length === 0) {
        return {
          content: [{ type: "text", text: "Error: Please provide a non-empty search query." }],
          details: { error: "empty_query" },
        };
      }

      // Build tools for the subagent (read-only + bash for fast searches)
      const subagentTools: AgentTool[] = [
        createReadTool(ctx.cwd),
        createGrepTool(ctx.cwd),
        createFindTool(ctx.cwd),
        createLsTool(ctx.cwd),
        createBashTool(ctx.cwd),
      ];

      // Resolve model: finder.json → session model
      const model = resolveOracleModel(ctx.modelRegistry) ?? ctx.model;
      if (!model) {
        return {
          content: [{ type: "text", text: "Error: No model available for finder subagent.\n\nTroubleshooting:\n  1. Create/edit ~/.pi/agent/finder.json with: {\"model\": \"provider/modelId\"}\n  2. Or set a session model with: /model provider/modelId" }],
          details: { error: "no_model", configPath: CONFIG_PATH },
        };
      }

      const modelId = `${model.provider}/${model.id}`;

      const subagentSignal = signal ? AbortSignal.any([signal]) : undefined;
      const timeoutAbort = new AbortController();

      // 3-minute timeout for complex searches
      const timeoutId = setTimeout(() => timeoutAbort.abort(), 180_000);
      const combinedSignal = subagentSignal
        ? AbortSignal.any([subagentSignal, timeoutAbort.signal])
        : timeoutAbort.signal;

      // Resolve API key and headers for the model before streaming
      const resolvedAuth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
      if (!resolvedAuth.ok) {
        return {
          content: [{ type: "text", text: `Error: Failed to resolve auth for model ${modelId}: ${resolvedAuth.error}` }],
          details: { error: "auth_resolution_failed", authError: resolvedAuth.error },
        };
      }

      // Show progress widget above editor
      ctx.ui.setWidget("finder", (tui, theme) => {
        finderProgress = new FinderProgress(tui, theme, params.query);
        return finderProgress;
      }, { placement: "belowEditor" });

      // Create the subagent Agent instance with isolated context
      const agent = new Agent({
        initialState: {
          systemPrompt: ORACLE_SYSTEM_PROMPT,
          model,
          tools: subagentTools,
        },
        streamFn: (m, c, opts) => stream(m, c, { ...opts, signal: combinedSignal, apiKey: resolvedAuth.apiKey, headers: resolvedAuth.headers }),
      });

      // Track files discovered for diminishing returns detection
      const discoveredFiles = new Set<string>();
      const filesRead = new Set<string>();
      const commandsRun: { tool: string; input: unknown }[] = [];
      let consecutiveTurnsWithNoNewFiles = 0;
      let turnCount = 0;
      const MAX_TURNS = 10;
      let forceSummarySent = false;

      // Helper to emit progress updates via onUpdate
      const emitProgress = (status: OracleStatus) => {
        if (!onUpdate) return;
        
        const recentTools = commandsRun.slice(-5).map(c => ({
          tool: c.tool,
          input: formatToolInput(c.tool, c.input),
        }));

        onUpdate({
          content: [{ type: "text", text: "" }], // Empty text, details have the info
          details: {
            query: params.query,
            status,
            model: modelId,
            turnCount,
            maxTurns: MAX_TURNS,
            filesFound: discoveredFiles.size,
            toolCalls: recentTools,
          } as OracleDetails,
        });
      };

      // Set initial status
      emitProgress("initializing");

      // Event expectations:
      // - tool_execution_start appends a running widget row
      // - turn_end marks current running rows done instead of clearing them
      // Subscribe to track turns and detect diminishing returns
      agent.subscribe((event) => {
        // Handle tool calls
        if (event.type === "tool_execution_start") {
          const evt = event as { toolName: string; args?: unknown };
          commandsRun.push({ tool: evt.toolName, input: evt.args });
          
          // Track files being read
          if (evt.toolName === "read" && (evt.args as { path?: string })?.path) {
            filesRead.add((evt.args as { path: string }).path);
          }
          
          finderProgress?.addTool(evt.toolName, summarizeToolLabel(evt.toolName, evt.args));
          emitProgress("searching");
        }
        
        if (event.type === "turn_end") {
          turnCount++;
          const turnEvent = event as { toolResults?: Array<{ content?: Array<{ type: string; text?: string }> }> };

          finderProgress?.markRunningToolsDone();

          // Check for new files in tool results
          let foundNewFiles = false;
          for (const toolResult of turnEvent.toolResults || []) {
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

          // Emit progress after turn
          emitProgress("searching");

          // If diminishing returns detected, force summary (only once)
          if (consecutiveTurnsWithNoNewFiles >= 2 && !forceSummarySent) {
            forceSummarySent = true;
            emitProgress("summarizing");
            finderProgress?.clearTools();
            agent.steer({
              role: "user",
              content: [{ type: "text", text: "You have sufficient context. No new files were found in the last 2 rounds. Summarize all your findings now using the required output format. Do not make more tool calls." }],
              timestamp: Date.now(),
            });
          }

          // If max turns reached, force summary (only once)
          if (turnCount >= MAX_TURNS && !forceSummarySent) {
            forceSummarySent = true;
            emitProgress("summarizing");
            finderProgress?.clearTools();
            agent.steer({
              role: "user",
              content: [{ type: "text", text: "Maximum search turns reached. Summarize all your findings now using the required output format." }],
              timestamp: Date.now(),
            });
          }
        }
      });

      // Helper to build result
      const getLogDetails = () => ({
        query: params.query,
        commandsRun: commandsRun.length,
        toolsUsed: [...new Set(commandsRun.map(c => c.tool))],
        filesRead: [...filesRead],
        filesReturned: [...discoveredFiles],
        turns: turnCount,
      });

      const buildResult = (isTimeout: boolean, lastError?: string): { text: string; details: Record<string, unknown> } => {
        // Extract result from agent state
        const messages = agent.state.messages;
        const lastAssistantMsg = messages
          .filter((m): m is Extract<typeof m, { role: "assistant" }> => m.role === "assistant")
          .pop();

        if (!lastAssistantMsg) {
          const timeoutNote = isTimeout ? "\n\n(Search timed out after 180s — partial results)" : "";
          const partialFindings = discoveredFiles.size > 0
            ? `Found ${discoveredFiles.size} files: ${[...discoveredFiles].slice(0, 10).join(", ")}${discoveredFiles.size > 10 ? "..." : ""}`
            : "No files were found before the search ended.";

          return {
            text: `Error: Finder subagent did not return a response.${timeoutNote}\n\n${partialFindings}`,
            details: { error: "no_response", turns: turnCount, filesFound: discoveredFiles.size, timedOut: isTimeout, ...getLogDetails() },
          };
        }

        // Extract text content
        const textParts = lastAssistantMsg.content.filter((c): c is TextContent => c.type === "text");
        const text = textParts.map(c => c.text).join("\n").trim();

        const timeoutNote = isTimeout ? "\n\n(Search timed out after 180s — results may be partial)" : "";
        const errorNote = lastError ? `\n\nError: ${lastError}` : "";
        const finalText = text + timeoutNote + errorNote;

        return {
          text: finalText,
          details: {
            query: params.query,
            status: "complete" as OracleStatus,
            model: modelId,
            turnCount,
            maxTurns: MAX_TURNS,
            filesFound: discoveredFiles.size,
            toolCalls: commandsRun.slice(-5).map(c => ({ tool: c.tool, input: formatToolInput(c.tool, c.input) })),
            filesDiscovered: [...discoveredFiles],
            timedOut: isTimeout,
            ...getLogDetails(),
          },
        };
      };

      // Run the search
      let searchError: Error | null = null;
      
      try {
        // Send the search query
        await agent.prompt(params.query);

        // Wait for the agent to finish
        await agent.waitForIdle();
      } catch (err) {
        searchError = err instanceof Error ? err : new Error(String(err));
      } finally {
        // Clean up progress widget
        ctx.ui.setWidget("finder", undefined);
        finderProgress?.dispose();
        finderProgress = null;
      }
      
      // Clean up timeout
      clearTimeout(timeoutId);
      
      // Handle error case
      if (searchError) {
        const errorMessage = searchError.message;
        const partialNote = discoveredFiles.size > 0
          ? `\n\nPartial findings before error: ${discoveredFiles.size} files discovered.`
          : "";
        const responseText = `Error: Finder subagent failed: ${errorMessage}.${partialNote}`;
        
        return {
          content: [{ type: "text", text: responseText }],
          details: { 
            query: params.query,
            status: "error" as OracleStatus,
            model: modelId,
            error: errorMessage, 
            turnCount,
            filesFound: discoveredFiles.size,
            toolCalls: commandsRun.slice(-5).map(c => ({ tool: c.tool, input: formatToolInput(c.tool, c.input) })),
            ...getLogDetails() 
          } as OracleDetails,
        };
      }
      
      // Build and return final result
      const result = buildResult(timeoutAbort.signal.aborted && !signal?.aborted);
      
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },

    renderCall(args: OracleInput, theme: any, _context: any) {
      // Widget handles progress display, return empty to avoid duplication
      return new Text("", 0, 0);
    },

    renderResult(result: any, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: any) {
      const details = result.details as OracleDetails | undefined;
      
      // During execution (streaming partial results) - widget handles progress
      if (isPartial) {
        return new Text("", 0, 0);
      }
      
      // Final result
      if (!details) {
        const text = result.content?.[0];
        return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
      }
      
      // Error case
      if (details.status === "error") {
        const text = result.content?.[0];
        const errorMsg = details.error || "Unknown error";
        let output = `${theme.fg("error", "✗ finder")}`;
        output += `\n${theme.fg("error", `Error: ${errorMsg}`)}`;
        if (details.filesFound > 0) {
          output += `\n${theme.fg("warning", `Partial findings: ${details.filesFound} files before error`)}`;
        }
        return new Text(output, 0, 0);
      }
      
      // Success case - show result directly
      const text = result.content?.[0];
      const textContent = text?.type === "text" ? text.text : "";
      
      // Just show the response text, simplified format
      return new Text(theme.fg("toolOutput", textContent), 0, 0);
    },
  });
}