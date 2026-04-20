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
interface OracleToolEntry {
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

class OracleProgress implements Component {
	private tui: TUI;
	private theme: { fg: (color: string, text: string) => string };
	private query: string;
	private mainLoader: Loader;
	private toolEntries: OracleToolEntry[];
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
		this.toolEntries = [];
		this.maxToolLines = 5;
		this.nextToolSequence = 1;

		this.mainLoader = new Loader(
			tui,
			theme.fg.bind(theme, "accent"),
			theme.fg.bind(theme, "muted"),
			`Oracle - analyzing ${query}`,
		);
	}

	addTool(toolName: string, label: string): void {
		const sequence = this.nextToolSequence++;
		const entry: OracleToolEntry = {
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

let oracleProgress: OracleProgress | null = null;

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

const ORACLE_SYSTEM_PROMPT = `You are Oracle, a deep reasoning specialist for software debugging and nuanced technical planning.
Your mission is to investigate tricky problems, generate competing explanations, gather evidence, and recommend the best next action.
You are responsible for root-cause analysis, trade-off-aware planning, and evidence-backed reasoning.
You are NOT responsible for implementing changes, editing files, or making speculative claims without evidence.

Read-only in spirit: you may inspect code and run safe verification commands, but you must not modify the repository.
Never use relative paths in your final answer. Always use absolute paths.
Never store results in files; return them as message text.

## Why This Matters
Shallow debugging creates symptom fixes that regress later. Premature certainty hides real uncertainty and wastes implementation time.
The caller is using you because the main agent is stuck, the problem is ambiguous, or the trade-offs are subtle.
Your job is to think harder than the default loop and surface the underlying issue or the best discriminating next probe.

## Success Criteria
- Restate the observation precisely before interpreting it.
- Generate 2-3 competing hypotheses when ambiguity exists.
- Collect evidence for and against each hypothesis.
- Cite specific file:line evidence whenever code supports a claim.
- Make trade-offs explicit when the task is about planning rather than debugging.
- End with either a best current explanation or a discriminating probe that would collapse uncertainty fastest.

## Constraints
- Do not implement fixes.
- Do not use bash to mutate the repository.
- Do not install packages.
- Do not bluff certainty when evidence is incomplete.
- Do not jump from symptom to fix without explaining the causal chain.
- Collect evidence against your leading hypothesis, not just evidence for it.

## Investigation Protocol
1. OBSERVE: Restate what was observed, asked, or proposed without interpretation.
2. FRAME: Define the exact question being answered.
3. HYPOTHESIZE: Generate competing explanations or approaches. Use deliberately different frames when possible.
4. GATHER EVIDENCE: Use read, grep, find, ls, and safe bash commands to collect evidence for and against each hypothesis.
5. REBUT: Challenge the current leading hypothesis with its strongest alternative.
6. SYNTHESIZE: Rank the remaining hypotheses by confidence and evidence strength.
7. PROBE: If uncertainty remains, name the critical unknown and the single best next probe.

## Context Budget
- Avoid reading large files end-to-end unless necessary.
- For files over 200 lines, prefer grep first, then targeted read with offset/limit.
- For files over 500 lines, do not full-read unless the caller explicitly asked for it.
- Batch reads must not exceed 5 files at once.
- Prefer code evidence over long narrative.

## Tool Usage
- Use read, grep, find, and ls to locate evidence in the codebase.
- Use bash only for safe verification such as tests, builds, diagnostics, git log, and git blame.
- Cross-check important claims across more than one signal when possible.
- Continue automatically through low-risk reasoning steps; do not stop at the first plausible explanation if uncertainty remains high.

## Execution Policy
- Default effort: high.
- Debugging tasks should converge toward the root cause, not the nearest symptom.
- Planning tasks should converge toward the safest justified direction, with trade-offs.
- Stop when one hypothesis clearly dominates, evidence plateaus, or the next probe is more valuable than further exploration.

## Output Format
Structure your response EXACTLY as follows. Do not add preamble or meta-commentary.

## Observation
[What was observed, without interpretation]

## Hypothesis Table
| Rank | Hypothesis | Confidence | Evidence Strength |
|------|------------|------------|-------------------|
| 1 | ... | High / Medium / Low | Strong / Moderate / Weak |

## Evidence For
- Hypothesis 1: ...
- Hypothesis 2: ...

## Evidence Against / Gaps
- Hypothesis 1: ...
- Hypothesis 2: ...

## Current Best Explanation
[Best current explanation, explicitly provisional if needed]

## Recommendations
1. [Concrete action]
2. [Concrete action]

## Discriminating Probe
[Single highest-value next step]

## Failure Modes to Avoid
- Symptom-fixing instead of root-cause analysis
- Returning only search results without reasoning
- Treating speculation as evidence
- Using bash for mutation instead of verification
- Hiding uncertainty when evidence is incomplete

## Final Checklist
- Did I state the observation before interpreting it?
- Did I preserve competing hypotheses where ambiguity exists?
- Did I collect evidence against my leading explanation?
- Did I cite file:line references where code supports the claim?
- Did I end with either a best explanation or a discriminating probe?`;

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
  const args = input && typeof input === "object" ? (input as Record<string, unknown>) : undefined;

  if (tool === "read") {
    const path = typeof args?.path === "string" ? args.path : undefined;
    return path ? `Read ${basename(path)}` : "Read evidence";
  }

  if (tool === "find") {
    const pattern = typeof args?.pattern === "string" ? args.pattern : undefined;
    const path = typeof args?.path === "string" ? args.path : undefined;
    const target = pattern || path;
    return target ? `Find ${basename(target)}` : "Find evidence";
  }

  if (tool === "grep") {
    const pattern = typeof args?.pattern === "string" ? args.pattern : undefined;
    return pattern ? `Trace ${pattern}` : "Trace pattern";
  }

  if (tool === "ls") {
    const path = typeof args?.path === "string" ? args.path : undefined;
    return path ? `Inspect ${basename(path)}` : "Inspect directory";
  }

  if (tool === "bash") {
    const command = typeof args?.command === "string"
      ? args.command
      : typeof input === "string"
        ? input
        : undefined;

    if (!command) return "Run verification";
    if (command.includes("git blame")) return "Inspect git blame";
    if (command.includes("git log")) return "Inspect git log";
    if (command.includes("npm test") || command.includes("pnpm test") || command.includes("go test")) return "Run tests";
    if (command.includes("npm run build") || command.includes("pnpm build") || command.includes("cargo build")) return "Run build";

    const compact = command.length > 36 ? `${command.slice(0, 36)}...` : command;
    return `Verify ${compact}`;
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
      ctx.ui.setWidget("oracle", (tui, theme) => {
        oracleProgress = new OracleProgress(tui, theme, params.query);
        return oracleProgress;
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
          
          oracleProgress?.addTool(evt.toolName, summarizeToolLabel(evt.toolName, evt.args));
          emitProgress("investigating");
        }
        
        if (event.type === "turn_end") {
          turnCount++;
          const turnEvent = event as { toolResults?: Array<{ content?: Array<{ type: string; text?: string }> }> };

          oracleProgress?.markRunningToolsDone();

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
          emitProgress("investigating");

          // If diminishing returns detected, force summary (only once)
          if (consecutiveTurnsWithNoNewFiles >= 2 && !forceSummarySent) {
            forceSummarySent = true;
            emitProgress("synthesizing");
            oracleProgress?.clearTools();
            agent.steer({
              role: "user",
              content: [{ type: "text", text: "You have sufficient context. No new files were found in the last 2 rounds. Summarize all your findings now using the required output format. Do not make more tool calls." }],
              timestamp: Date.now(),
            });
          }

          // If max turns reached, force summary (only once)
          if (turnCount >= MAX_TURNS && !forceSummarySent) {
            forceSummarySent = true;
            emitProgress("synthesizing");
            oracleProgress?.clearTools();
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
        ctx.ui.setWidget("oracle", undefined);
        oracleProgress?.dispose();
        oracleProgress = null;
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
        let output = `${theme.fg("error", "✗ oracle")}`;
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