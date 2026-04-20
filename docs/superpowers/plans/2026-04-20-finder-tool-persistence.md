# Finder Tool Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `finder.ts` so the finder widget keeps tool lines visible, orders running tools before recent completed tools, and preserves Pi's default `Working...` line below the widget.

**Architecture:** Replace the current active-loader-only tool tracking with explicit tool entry state inside `FinderProgress`. Tool entries will transition from `running` to `done` at turn boundaries and rendering will select up to five visible entries with running-first, recent-completed-second ordering.

**Tech Stack:** TypeScript, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, existing finder extension code in `finder.ts`

---

## File Structure

- Modify: `finder.ts`
  - Add explicit `FinderToolEntry` state for running/completed tool rows
  - Replace `clearTools()` turn-end behavior with `markRunningToolsDone()`
  - Update widget rendering to show `Tool N <toolName>` rows and `+ N more`
- Verify manually from `finder.ts`
  - No dedicated automated tests currently exist in this repo for the TUI widget behavior, so verification will use TypeScript compilation and targeted manual execution guidance

### Task 1: Replace transient tool-loader state with persistent tool entries

**Files:**
- Modify: `finder.ts`

- [ ] **Step 1: Write the failing test surrogate as an executable expectation checklist**

Because this repo does not currently contain an automated test harness for `FinderProgress`, document the red-phase expectations directly in code comments near the new state model before implementation:

```ts
// Expected widget behavior:
// 1. tool_execution_start adds a visible running row: "Tool N <toolName>"
// 2. turn_end does not clear history; it marks running rows done
// 3. render() shows running rows first, then recent completed rows
// 4. render() shows at most 5 tool rows plus optional "+ N more"
```

- [ ] **Step 2: Verify the current code fails the expectation**

Run:
```bash
rg -n "clearTools\(\);|toolLoaders|removeTool\(" finder.ts
```

Expected:
- Finds `finderProgress?.clearTools();` inside the `turn_end` handler
- Finds the old `toolLoaders` implementation, confirming current behavior clears tool rows instead of preserving them

- [ ] **Step 3: Add the persistent tool-entry types and state**

Replace the current `FinderProgress` tool state with a focused entry model:

```ts
interface FinderToolEntry {
  id: string;
  toolName: string;
  label: string;
  status: "running" | "done";
  sequence: number;
  doneAt?: number;
  loader?: Loader;
}
```

Inside `FinderProgress`, replace:

```ts
private toolLoaders: Map<string, { loader: Loader; input: string }>;
private maxToolLines: number;
private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
private toolFrameOffsets: Map<string, number>;
```

with:

```ts
private toolEntries: FinderToolEntry[];
private maxToolLines: number;
private nextToolSequence: number;
```

And initialize them in the constructor:

```ts
this.toolEntries = [];
this.maxToolLines = 5;
this.nextToolSequence = 1;
```

- [ ] **Step 4: Run a syntax check after adding the types/state**

Run:
```bash
npx tsc --noEmit finder.ts
```

Expected:
- Type errors will still exist until the old methods are rewritten, but parser-level syntax should remain valid

- [ ] **Step 5: Commit the state-model scaffold**

```bash
git add finder.ts
git commit -m "refactor: add persistent finder tool entry state"
```

### Task 2: Rework `FinderProgress` lifecycle and rendering

**Files:**
- Modify: `finder.ts`

- [ ] **Step 1: Write the failing test surrogate for render ordering**

Add a short comment above `render(width)` describing the required ordering:

```ts
// Render order:
// - main finder task line
// - running tools in sequence order
// - completed tools by most recent completion
// - overflow line when more than maxToolLines exist
```

- [ ] **Step 2: Verify the old render implementation cannot satisfy the requirement**

Run:
```bash
rg -n "const toolEntries = \[\.\.\.this\.toolLoaders|lines\.push\(`   \$\{toolLine\}`\)" finder.ts
```

Expected:
- Matches the old loader-map rendering code that does not distinguish running vs completed tools

- [ ] **Step 3: Replace `addTool`, remove `removeTool`, and implement completion tracking**

Update `FinderProgress` with these methods:

```ts
addTool(toolName: string): void {
  const sequence = this.nextToolSequence++;
  const label = `Tool ${sequence} ${toolName}`;
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
```

- [ ] **Step 4: Rewrite `render(width)` to enforce the new display rules**

Use this structure:

```ts
render(width: number): string[] {
  const lines: string[] = [];
  const mainLines = this.mainLoader.render(width);
  lines.push(mainLines[1] || "");

  const running = this.toolEntries
    .filter((entry) => entry.status === "running")
    .sort((a, b) => a.sequence - b.sequence);

  const completed = this.toolEntries
    .filter((entry) => entry.status === "done")
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  const visible = [...running, ...completed].slice(0, this.maxToolLines);
  const hiddenCount = Math.max(0, running.length + completed.length - visible.length);

  for (const entry of visible) {
    if (entry.status === "running" && entry.loader) {
      const toolLines = entry.loader.render(width - 3);
      lines.push(`   ${toolLines[1] || ""}`);
    } else {
      lines.push(`   ${this.theme.fg("dim", entry.label)}`);
    }
  }

  if (hiddenCount > 0) {
    lines.push(`   ${this.theme.fg("dim", `+ ${hiddenCount} more`)}`);
  }

  return lines;
}
```

Also update `dispose()` and `invalidate()` to iterate over `toolEntries` instead of `toolLoaders`.

- [ ] **Step 5: Run TypeScript verification**

Run:
```bash
npx tsc --noEmit finder.ts
```

Expected:
- PASS with no TypeScript errors from the rewritten `FinderProgress`

- [ ] **Step 6: Commit the rendering rewrite**

```bash
git add finder.ts
git commit -m "feat: persist finder tool rows in widget"
```

### Task 3: Wire the new progress behavior into finder execution

**Files:**
- Modify: `finder.ts`

- [ ] **Step 1: Write the failing test surrogate for event handling**

Add a concise comment near the event subscription:

```ts
// Event expectations:
// - tool_execution_start appends a running widget row
// - turn_end marks current running rows done instead of clearing them
```

- [ ] **Step 2: Verify the current event wiring still uses the old behavior**

Run:
```bash
rg -n "addTool\(|clearTools\(\)|formatToolInput\(" finder.ts
```

Expected:
- Shows `addTool(evt.toolName, input)` and `finderProgress?.clearTools();`, proving the event code still depends on the old API before this step

- [ ] **Step 3: Update the event subscription to use the new API**

Replace the tool-start and turn-end widget calls:

```ts
if (event.type === "tool_execution_start") {
  const evt = event as { toolName: string; args?: unknown };
  commandsRun.push({ tool: evt.toolName, input: evt.args });

  if (evt.toolName === "read" && (evt.args as { path?: string })?.path) {
    filesRead.add((evt.args as { path: string }).path);
  }

  finderProgress?.addTool(evt.toolName);
  emitProgress("searching");
}

if (event.type === "turn_end") {
  turnCount++;
  const turnEvent = event as { toolResults?: Array<{ content?: Array<{ type: string; text?: string }> }> };

  finderProgress?.markRunningToolsDone();

  // existing discovered-files logic stays intact
}
```

Keep `finderProgress?.clearTools();` only in cleanup paths such as `dispose()`/`finally`, not during normal turn progression.

- [ ] **Step 4: Run end-to-end verification commands**

Run:
```bash
npx tsc --noEmit finder.ts
rg -n "markRunningToolsDone|clearTools\(\);|addTool\(" finder.ts
```

Expected:
- TypeScript compile passes
- `markRunningToolsDone` is present
- no `finderProgress?.clearTools();` remains in the `turn_end` block
- `addTool` is called with just the tool name

- [ ] **Step 5: Commit the event integration**

```bash
git add finder.ts
git commit -m "fix: keep finder tool widget rows visible across turns"
```

### Task 4: Final verification

**Files:**
- Modify: `finder.ts`
- Verify: `docs/superpowers/specs/2026-04-20-finder-tool-persistence-design.md`

- [ ] **Step 1: Run the full verification checklist**

Run:
```bash
npx tsc --noEmit finder.ts
git diff -- finder.ts docs/superpowers/specs/2026-04-20-finder-tool-persistence-design.md
```

Expected:
- TypeScript compile passes
- Diff shows only the intended widget/state/event updates in `finder.ts`

- [ ] **Step 2: Manual runtime verification guidance**

Run the finder extension in Pi with a query that triggers multiple tool calls, then verify:

```text
1. The widget appears above the editor
2. The first line reads: "Finder Task - <query>"
3. Tool rows appear as "Tool N <toolName>"
4. Running rows show a spinner
5. Completed rows remain visible without a spinner
6. Running rows appear before completed rows
7. Pi's normal "Working..." line remains below the widget
8. "+ N more" appears when more than 5 tool rows exist
```

- [ ] **Step 3: Commit the verified implementation**

```bash
git add finder.ts
git commit -m "chore: verify finder widget tool persistence behavior"
```
