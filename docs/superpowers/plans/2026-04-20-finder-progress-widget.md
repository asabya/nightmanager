# Finder Progress Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a progress widget to finder extension that shows a spinning loader and status message above the editor during searches.

**Architecture:** Create `FinderProgress` component wrapping `Loader` from pi-tui, integrate into finder.ts via `ctx.ui.setWidget()` with lifecycle management.

**Tech Stack:** TypeScript, pi-tui components (Loader), pi-coding-agent extension API

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `finder-progress.ts` | Create | FinderProgress component wrapping Loader |
| `finder.ts` | Modify | Integrate widget lifecycle and message updates |

---

### Task 1: Create FinderProgress Component

**Files:**
- Create: `finder-progress.ts`

- [ ] **Step 1: Create FinderProgress component file**

Create `finder-progress.ts` with the FinderProgress component:

```typescript
import type { Component } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import { Loader } from "@mariozechner/pi-tui";

/**
 * Progress indicator for finder subagent searches.
 * Wraps Loader component for use as a TUI widget.
 */
export class FinderProgress implements Component {
	private loader: Loader;

	constructor(
		tui: TUI,
		theme: { fg: (color: string, text: string) => string },
		message: string = "Searching...",
	) {
		this.loader = new Loader(
			tui,
			theme.fg.bind(theme, "accent"),
			theme.fg.bind(theme, "muted"),
			message,
		);
	}

	setMessage(message: string): void {
		this.loader.setMessage(message);
	}

	dispose(): void {
		this.loader.stop();
	}

	render(width: number): string[] {
		return this.loader.render(width);
	}

	invalidate(): void {
		this.loader.invalidate();
	}
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager && npx tsc --noEmit finder-progress.ts 2>&1 || echo "Note: May need pi-tui types installed"`

Expected: File compiles without errors (or only missing type declarations from dependencies)

- [ ] **Step 3: Commit**

```bash
git add finder-progress.ts
git commit -m "feat(finder): add FinderProgress component wrapping Loader"
```

---

### Task 2: Integrate Widget Lifecycle in finder.ts

**Files:**
- Modify: `finder.ts`

- [ ] **Step 1: Add import for FinderProgress**

At the top of `finder.ts`, add the import after existing imports:

```typescript
import { FinderProgress } from "./finder-progress.js";
```

- [ ] **Step 2: Add module-level variable for progress reference**

Add after the imports, before the schema definitions:

```typescript
// Progress widget reference for updates during search
let finderProgress: FinderProgress | null = null;
```

- [ ] **Step 3: Show widget at start of execute**

In the `execute` function, after the model resolution check, add widget creation. Find the line `const modelId = ...` and add after the error handling for `resolvedAuth`:

```typescript
		// Show progress widget above editor
		ctx.ui.setWidget("finder", (tui, theme) => {
			finderProgress = new FinderProgress(tui, theme, "Searching...");
			return finderProgress;
		}, { placement: "aboveEditor" });
```

- [ ] **Step 4: Update progress message during tool execution**

In the `agent.subscribe` callback, inside the `tool_execution_start` handler, update the message. Find the existing handler:

```typescript
		if (event.type === "tool_execution_start") {
			const evt = event as { toolName: string; args?: unknown };
			commandsRun.push({ tool: evt.toolName, input: evt.args });
```

Add after `commandsRun.push(...)`:

```typescript
			// Update progress with current tool
			const toolIcon = getToolIcon(evt.toolName);
			finderProgress?.setMessage(`${toolIcon} ${evt.toolName}...`);
```

- [ ] **Step 5: Update progress when files found**

In the `turn_end` handler, after updating `consecutiveTurnsWithNoNewFiles` and the files found, update progress. Find after `discoveredFiles.size` is updated:

```typescript
			if (foundNewFiles && turnCount > 1) {
				consecutiveTurnsWithNoNewFiles = 0;
			}
```

Add after:

```typescript
			// Update progress with files found
			if (discoveredFiles.size > 0) {
				const fileWord = discoveredFiles.size === 1 ? "file" : "files";
				finderProgress?.setMessage(`Found ${discoveredFiles.size} ${fileWord}...`);
			}
```

- [ ] **Step 6: Update progress when summarizing**

In the `turn_end` handler, find the `forceSummarySent` block where summarizing message is sent. After `emitProgress("summarizing")`:

```typescript
			if (consecutiveTurnsWithNoNewFiles >= 2 && !forceSummarySent) {
				forceSummarySent = true;
				emitProgress("summarizing");
				// Update progress
				finderProgress?.setMessage("Summarizing results...");
				agent.steer({
```

Do the same for the max turns block:

```typescript
			if (turnCount >= MAX_TURNS && !forceSummarySent) {
				forceSummarySent = true;
				emitProgress("summarizing");
				// Update progress
				finderProgress?.setMessage("Summarizing results...");
				agent.steer({
```

- [ ] **Step 7: Add cleanup in finally block**

Wrap the main execution in try/finally. Find the search execution block and restructure:

```typescript
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
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager && npx tsc --noEmit finder.ts finder-progress.ts 2>&1`

Expected: No TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add finder.ts
git commit -m "feat(finder): integrate progress widget with search lifecycle"
```

---

### Task 3: Manual Testing

**Files:**
- None (testing only)

- [ ] **Step 1: Test basic search**

1. Start pi with the finder extension: `pi -e ./finder.ts`
2. Run: "Use finder to find authentication middleware"
3. Verify:
   - Progress widget appears above editor during search
   - Spinner animates
   - Message updates with tool names ("📖 read...", "🔍 grep...")
   - Widget disappears when search completes

- [ ] **Step 2: Test error handling**

1. Run finder with a query that might timeout or error
2. Verify widget disappears even on error

- [ ] **Step 3: Test abort (Ctrl+C)**

1. Start a long-running finder search
2. Press Ctrl+C to abort
3. Verify widget cleans up properly

---

## Self-Review Checklist

- [x] Spec coverage: All requirements from design doc covered
- [x] No placeholders: All steps have actual code
- [x] Type consistency: FinderProgress interface matches usage
- [x] Import paths use `.js` extension for ESM compatibility