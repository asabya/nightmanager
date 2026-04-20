# Two-Line Finder Progress Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the finder progress widget to show a two-line display with the main task and currently running tools, each with independent animated loaders.

**Architecture:** Replace the single-loader `FinderProgress` class with a multi-loader implementation that tracks running tools in a Map, creates independent Loader instances for each, and caps display at 5 tools with overflow indicator.

**Tech Stack:** TypeScript, pi-tui Loader component, pi-coding-agent extension API

---

## Files Changed

- `finder.ts` - Rewrite `FinderProgress` class and update `execute()` event handling

---

### Task 1: Rewrite FinderProgress Class

**Files:**
- Modify: `finder.ts:46-77` (FinderProgress class)

- [ ] **Step 1: Replace the FinderProgress class with the new multi-loader implementation**

Replace the existing `FinderProgress` class (lines 46-77) with:

```typescript
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
			const frame = this.frames[Math.floor(Date.now() / 80) % this.frames.length];
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
```

- [ ] **Step 2: Remove the global finderProgress reference update in setMessage usage**

The old `finderProgress?.setMessage(...)` calls need to be replaced with the new API. Find and note these locations for Task 3.

---

### Task 2: Update Widget Creation to Pass Query

**Files:**
- Modify: `finder.ts:274-277` (widget creation in execute())

- [ ] **Step 1: Update widget creation to use query instead of "Searching..."**

Find the widget creation code around line 274:

```typescript
// Show progress widget above editor
ctx.ui.setWidget("finder", (tui, theme) => {
  finderProgress = new FinderProgress(tui, theme, "Searching...");
  return finderProgress;
}, { placement: "aboveEditor" });
```

Replace with:

```typescript
// Show progress widget above editor
ctx.ui.setWidget("finder", (tui, theme) => {
  finderProgress = new FinderProgress(tui, theme, params.query);
  return finderProgress;
}, { placement: "aboveEditor" });
```

---

### Task 3: Update Event Handlers to Use New API

**Files:**
- Modify: `finder.ts:295-330` (agent.subscribe event handlers)

- [ ] **Step 1: Update tool_execution_start handler to use addTool**

Find the `tool_execution_start` handler (around line 295):

```typescript
if (event.type === "tool_execution_start") {
  const evt = event as { toolName: string; args?: unknown };
  commandsRun.push({ tool: evt.toolName, input: evt.args });
  
  // Track files being read
  if (evt.toolName === "read" && (evt.args as { path?: string })?.path) {
    filesRead.add((evt.args as { path: string }).path);
  }
  
  // Update progress with current tool
  finderProgress?.setMessage(`${evt.toolName}...`);
  
  // Emit progress with new tool call
  emitProgress("searching");
}
```

Replace with:

```typescript
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
```

- [ ] **Step 2: Update turn_end handler to remove completed tools**

Find the `turn_end` handler (around line 303). After tracking files, add tool removal:

```typescript
if (event.type === "turn_end") {
  turnCount++;
  const turnEvent = event as { toolResults?: Array<{ content?: Array<{ type: string; text?: string }> }> };

  // Remove completed tools from progress display
  // Tools that started in this turn should now be complete
  finderProgress?.clearTools();

  // Check for new files in tool results
  let foundNewFiles = false;
  // ... rest of existing code ...
}
```

- [ ] **Step 3: Update diminishing returns handler to use new API**

Find the diminishing returns handler (around line 329):

```typescript
// Update progress with files found
if (discoveredFiles.size > 0) {
  const fileWord = discoveredFiles.size === 1 ? "file" : "files";
  finderProgress?.setMessage(`Found ${discoveredFiles.size} ${fileWord}...`);
}
```

Replace with:

```typescript
// Progress is now shown via tool loaders, no need to update main message
// The main loader shows the query, tool loaders show current tools
```

- [ ] **Step 4: Remove setMessage calls for summarizing**

Find the summarizing message updates (around line 340):

```typescript
if (consecutiveTurnsWithNoNewFiles >= 2 && !forceSummarySent) {
  forceSummarySent = true;
  emitProgress("summarizing");
  finderProgress?.setMessage("Summarizing results...");
  // ... steer ...
}
```

Replace with:

```typescript
if (consecutiveTurnsWithNoNewFiles >= 2 && !forceSummarySent) {
  forceSummarySent = true;
  emitProgress("summarizing");
  finderProgress?.clearTools();
  // ... steer ...
}
```

And similarly for the max turns case (around line 350):

```typescript
if (turnCount >= MAX_TURNS && !forceSummarySent) {
  forceSummarySent = true;
  emitProgress("summarizing");
  finderProgress?.clearTools();
  // ... steer ...
}
```

---

### Task 4: Verify and Test

- [ ] **Step 1: TypeScript compile check**

Run: `cd /Users/sabyasachipatra/go/src/github.com/asabya/subagents && npx tsc --noEmit finder.ts`

Expected: No type errors

- [ ] **Step 2: Manual test with pi**

Run: `pi -e ./finder.ts`

Then: Ask "Use finder to find README.md files"

Expected: 
- Main line shows: `⠼ Finder Task - Use finder to find README.md files`
- Tool lines show running tools as they execute
- Multiple tools can display simultaneously
- Tools clear after turn ends

- [ ] **Step 3: Commit changes**

```bash
git add finder.ts
git commit -m "feat: two-line finder progress with multi-tool tracking

- Main line shows query with animated loader
- Tool lines show running tools (up to 5) with independent loaders
- Tab-indented tool lines appear above default Working... text
- Tools cleared on turn_end, capped at 5 with overflow indicator"
```