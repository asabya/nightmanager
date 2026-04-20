/**
 * Finder Subagent Extension for Pi
 *
 * Registers a `finder` tool that spawns a dedicated search subagent with:
 * - Its own context window (isolated from the main agent)
 * - Configurable model via ~/.pi/agent/finder.json (just a model reference string)
 * - Read-only tools (read, grep, find, ls) + bash for fast searches
 * - Exploration-focused system prompt with parallel search strategies
 * - Automatic turn limiting (max 10 turns)
 * - Diminishing returns detection (2 turns with no new files → force summary)
 * - 3-minute timeout for complex searches
 * - Inline progress display via onUpdate streaming
 *
 * Usage:
 *   pi -e ./finder.ts
 *   Then: "Use finder to find the auth middleware"
 *
 * Config (~/.pi/agent/finder.json) — optional:
 *   {
 *     "model": "ollama/glm-5:cloud"
 *   }
 *
 * Format is "provider/modelId" matching entries in your models.json.
 * Falls back to the session model if no config is found.
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
class FinderProgress implements Component {
	private tui: TUI;
	private theme: { fg: (color: string, text: string) => string };
	private query: string;
	private mainLoader: Loader;
	private toolLoaders: Map<string, { loader: Loader; input: string }>;
	private maxToolLines: number;
	private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	private toolFrameOffsets: Map<string, number>;

	constructor(
		tui: TUI,
		theme: { fg: (color: string, text: string) => string },
		query: string,
	) {
		this.tui = tui;
		this.theme = theme;
		this.query = query;
		this.toolLoaders = new Map();
		this.toolFrameOffsets = new Map();
		this.maxToolLines = 5;
		
		// Main loader always visible
		this.mainLoader = new Loader(
			tui,
			theme.fg.bind(theme, "accent"),
			theme.fg.bind(theme, "muted"),
			`Finder Task - ${query}`,
		);
	}

	/**
	 * Add a running tool to the display.
	 * Creates a new loader for the tool with independent animation.
	 */
	addTool(toolName: string, input: string): void {
		// Use toolName + truncated input as unique key
		const key = `${toolName}:${input.slice(0, 30)}`;
		
		if (this.toolLoaders.has(key)) {
			return; // Already tracking this tool
		}
		
		// Give each tool loader a random frame offset for visual variety
		const frameOffset = Math.floor(Math.random() * this.frames.length);
		this.toolFrameOffsets.set(key, frameOffset);
		
		const loader = new Loader(
			this.tui,
			this.theme.fg.bind(this.theme, "accent"),
			this.theme.fg.bind(this.theme, "dim"),
			`${toolName} ${input}`,
		);
		
		this.toolLoaders.set(key, { loader, input });
	}

	/**
	 * Remove a tool from the display when it completes.
	 */
	removeTool(toolName: string, input: string): void {
		// Find matching key (input might be truncated differently)
		const prefix = `${toolName}:`;
		for (const [key, value] of this.toolLoaders) {
			if (key.startsWith(prefix)) {
				value.loader.stop();
				this.toolLoaders.delete(key);
				this.toolFrameOffsets.delete(key);
				break;
			}
		}
	}

	/**
	 * Clear all tool loaders.
	 */
	clearTools(): void {
		for (const { loader } of this.toolLoaders.values()) {
			loader.stop();
		}
		this.toolLoaders.clear();
		this.toolFrameOffsets.clear();
	}

	dispose(): void {
		this.mainLoader.stop();
		this.clearTools();
	}

	render(width: number): string[] {
		const lines: string[] = [];
		
		// Main line from mainLoader
		const mainLines = this.mainLoader.render(width);
		lines.push(mainLines[1] || ""); // Skip the empty first line from Loader.render
		
		// Tool lines (up to maxToolLines)
		const toolEntries = [...this.toolLoaders.entries()];
		const visibleTools = toolEntries.slice(0, this.maxToolLines);
		const hiddenCount = toolEntries.length - this.maxToolLines;
		
		for (const [key, { loader }] of visibleTools) {
			const toolLines = loader.render(width - 3); // Account for tab indent
			const toolLine = toolLines[1] || "";
			lines.push(`   ${toolLine}`); // Tab indent (3 spaces)
		}
		
		// Overflow indicator
		if (hiddenCount > 0) {
			lines.push(`   ${this.theme.fg("dim", `+ ${hiddenCount} more`)}`);
		}
		
		return lines;
	}

	invalidate(): void {
		this.mainLoader.invalidate();
		for (const { loader } of this.toolLoaders.values()) {
			loader.invalidate();
		}
	}
}

// Progress widget reference for updates during search
let finderProgress: FinderProgress | null = null;

// =========================================================================
// Schema and Types
// =========================================================================

const finderSchema = Type.Object({
  query: Type.String({
    description: "Natural language description of what to find in the codebase. Be specific about file names, patterns, or concepts.",
  }),
});

type FinderInput = Static<typeof finderSchema>;

/** Status of the finder subagent */
type FinderStatus = "initializing" | "searching" | "summarizing" | "complete" | "error";

/** A single tool call record for display */
interface ToolCallRecord {
  tool: string;
  input: string; // Truncated input for display
}

/** Progress/result details for finder */
interface FinderDetails {
  query: string;
  status: FinderStatus;
  model: string;
  turnCount: number;
  maxTurns: number;
  filesFound: number;
  toolCalls: ToolCallRecord[];
  error?: string;
  filesDiscovered?: string[];
  timedOut?: boolean;
}

// =========================================================================
// Config loading — simple model reference only
// =========================================================================

interface FinderConfig {
  model: string; // "provider/modelId" e.g. "ollama/glm-5:cloud"
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "finder.json");

function loadFinderModelReference(): string | null {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed: FinderConfig = JSON.parse(raw);
    if (!parsed.model) {
      return null;
    }
    return parsed.model;
  } catch {
    // Config file not found or invalid - use session model
    return null;
  }
}

// =========================================================================
// Model resolution (lazy — uses modelRegistry from context)
// =========================================================================

let cachedFinderModel: Model<any> | null = null;

function resolveFinderModel(modelRegistry: any): Model<any> | null {
  if (cachedFinderModel) return cachedFinderModel;

  const modelRef = loadFinderModelReference();
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

  cachedFinderModel = model as Model<any>;
  return cachedFinderModel;
}

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
    async execute(toolCallId: string, params: FinderInput, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined, ctx: ExtensionContext) {
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
      const model = resolveFinderModel(ctx.modelRegistry) ?? ctx.model;
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
      }, { placement: "aboveEditor" });

      // Create the subagent Agent instance with isolated context
      const agent = new Agent({
        initialState: {
          systemPrompt: FINDER_SYSTEM_PROMPT,
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
      const emitProgress = (status: FinderStatus) => {
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
          } as FinderDetails,
        });
      };

      // Set initial status
      emitProgress("initializing");

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
          
          // Add tool to progress display
          const input = formatToolInput(evt.toolName, evt.args);
          finderProgress?.addTool(evt.toolName, input);
          
          // Emit progress with new tool call
          emitProgress("searching");
        }
        
        if (event.type === "turn_end") {
          turnCount++;
          const turnEvent = event as { toolResults?: Array<{ content?: Array<{ type: string; text?: string }> }> };

          // Clear completed tools from progress display
          finderProgress?.clearTools();

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
            status: "complete" as FinderStatus,
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
            status: "error" as FinderStatus,
            model: modelId,
            error: errorMessage, 
            turnCount,
            filesFound: discoveredFiles.size,
            toolCalls: commandsRun.slice(-5).map(c => ({ tool: c.tool, input: formatToolInput(c.tool, c.input) })),
            ...getLogDetails() 
          } as FinderDetails,
        };
      }
      
      // Build and return final result
      const result = buildResult(timeoutAbort.signal.aborted && !signal?.aborted);
      
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },

    renderCall(args: FinderInput, theme: any, _context: any) {
      const query = args.query || "";
      const truncated = query.length > 80 ? query.slice(0, 80) + "..." : query;
      // Role badge style: [finder] with accent background
      const badge = theme.bg("toolPendingBg", theme.fg("accent", theme.bold(" finder ")));
      return new Text(
        `${badge} ${theme.fg("muted", `"${truncated}"`)}`,
        0, 0
      );
    },

    renderResult(result: any, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: any) {
      const details = result.details as FinderDetails | undefined;
      
      // During execution (streaming partial results)
      if (isPartial && details) {
        const statusIcon = details.status === "summarizing" ? "⏳" : "🔍";
        const statusText = details.status === "summarizing" 
          ? theme.fg("warning", "Summarizing...")
          : theme.fg("accent", "Searching...");
        
        // Build progress line
        const progress = `${theme.fg("accent", statusIcon)} ${theme.fg("toolTitle", theme.bold("finder "))}${theme.fg("muted", `"${details.query.slice(0, 50)}${details.query.length > 50 ? "..." : ""}"`)}`;
        const status = `  ${statusText} ${theme.fg("dim", `turn ${details.turnCount}/${details.maxTurns}, ${details.filesFound} files`)}`;
        
        // Show recent tool calls
        const lines = [progress, status];
        
        if (details.toolCalls && details.toolCalls.length > 0) {
          for (const call of details.toolCalls.slice(-3)) {
            const toolName = theme.fg("toolTitle", call.tool);
            const input = theme.fg("muted", call.input);
            lines.push(`    ${toolName} ${input}`);
          }
        }
        
        return new Text(lines.join("\n"), 0, 0);
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
      
      // Success case
      const badge = theme.bg("toolSuccessBg", theme.fg("success", theme.bold(" finder ")));
      
      const text = result.content?.[0];
      const textContent = text?.type === "text" ? text.text : "";
      
      // Header line
      const header = `${badge} ${theme.fg("dim", `[${details.model}]`)} ${theme.fg("muted", `${details.turnCount} turns, ${details.filesFound} files`)}`;
      
      if (!expanded) {
        // Collapsed view
        const previewLines = textContent.split("\n").slice(0, 5);
        let output = header;
        
        if (previewLines.length > 0 && previewLines[0]) {
          output += `\n${theme.fg("toolOutput", previewLines[0].slice(0, 100))}`;
          if (previewLines[0].length > 100 || previewLines.length > 1) {
            output += `\n${theme.fg("dim", "... (Ctrl+O to expand)")}`;
          }
        }
        
        return new Text(output, 0, 0);
      }
      
      // Expanded view
      let output = header;
      
      // Show query
      output += `\n${theme.fg("muted", "Query:")} ${theme.fg("dim", details.query)}`;
      
      // Show files discovered
      if (details.filesDiscovered && details.filesDiscovered.length > 0) {
        const filesToShow = details.filesDiscovered.slice(0, 10);
        output += `\n${theme.fg("muted", "Files:")} ${theme.fg("dim", filesToShow.join(", "))}`;
        if (details.filesDiscovered.length > 10) {
          output += ` ${theme.fg("dim", `... +${details.filesDiscovered.length - 10} more`)}`;
        }
      }
      
      // Show output
      if (textContent) {
        output += `\n\n${theme.fg("toolOutput", truncateToWidth(textContent, 2000))}`;
      }
      
      return new Text(output, 0, 0);
    },
  });
}