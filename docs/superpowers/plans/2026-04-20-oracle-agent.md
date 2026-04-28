# Oracle Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an `oracle` custom tool for Pi that follows the same single-file subagent structure as `finder.ts` but is optimized for deep reasoning on tricky debugging and nuanced planning tasks.

**Architecture:** Create `oracle.ts` as a sibling of `finder.ts` by reusing Finder's isolated-subagent, config-loading, progress-widget, and render pipeline structure. Replace Finder's search-specific prompt, naming, stop conditions, and output shape with an Oracle reasoning contract inspired by the `debugger`, `tracer`, and `architect` prompts from the p2p-harness prompt library.

**Tech Stack:** TypeScript, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`, TypeBox

---

## File Structure

```text
oracle.ts   # New single-file Oracle extension: tool registration, config loading, prompt, progress widget, subagent execution, rendering
README.md   # Add Oracle usage and configuration docs without removing Finder docs
finder.ts   # Reference implementation only; do not modify unless an implementation bug in the shared pattern is discovered
```

### Boundaries
- `oracle.ts` owns all Oracle-specific behavior.
- `finder.ts` remains the reference template, not a dependency.
- `README.md` documents installation, model config, and example prompts for Oracle.

### Verification Strategy
This repo does not currently include a local package manifest or test runner. Use **acceptance-first smoke checks** as the red/green loop:
1. Run a Pi CLI prompt that should fail or show the wrong behavior.
2. Make the minimal code change.
3. Re-run the same prompt and verify the behavior changes as intended.

---

### Task 1: Bootstrap `oracle.ts` from the Finder structure

**Files:**
- Create: `oracle.ts`
- Reference only: `finder.ts`

- [ ] **Step 1: Run the failing smoke check before the file exists**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
pi -e ./oracle.ts -p "Use oracle to debug why auth middleware fails intermittently"
```

Expected: Pi fails to load `./oracle.ts` because the file does not exist yet.

- [ ] **Step 2: Copy `finder.ts` to `oracle.ts` to preserve the exact single-file structure**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
cp finder.ts oracle.ts
```

Expected: `oracle.ts` exists and is byte-for-byte identical to `finder.ts` before Oracle-specific edits.

- [ ] **Step 3: Rename the top-level Oracle symbols, schema names, config names, and tool registration metadata**

Apply these exact replacements in `oracle.ts`.

Replace the schema/types/config block with:

```ts
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

interface OracleConfig {
  model: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "oracle.json");
```

Replace the config/model helper names with:

```ts
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
```

Replace the tool registration signature with:

```ts
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
```

Replace Finder-specific type references throughout the file:

```ts
FinderInput -> OracleInput
FinderStatus -> OracleStatus
FinderDetails -> OracleDetails
finderSchema -> oracleSchema
resolveFinderModel -> resolveOracleModel
```

- [ ] **Step 4: Update the header comment so the file identifies itself as Oracle**

Replace the header comment at the top of `oracle.ts` with:

```ts
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
```

- [ ] **Step 5: Run the green smoke check to verify the tool now loads under the Oracle name**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
pi -e ./oracle.ts -p "List available tools and confirm oracle is registered"
```

Expected: Pi loads successfully and the tool list includes `oracle`.

- [ ] **Step 6: Commit the bootstrap work**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
git add oracle.ts
git commit -m "feat: bootstrap oracle subagent from finder structure"
```

---

### Task 2: Replace Finder's search contract with the Oracle reasoning contract

**Files:**
- Modify: `oracle.ts`

- [ ] **Step 1: Run the failing behavior check to confirm Oracle still behaves like Finder**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
pi -e ./oracle.ts -p "Use oracle to debug why auth middleware fails intermittently"
```

Expected: The current output is Finder-style search output (for example `## Findings` / `## Impact`) rather than a reasoning report with `## Observation` and `## Hypothesis Table`.

- [ ] **Step 2: Replace `FINDER_SYSTEM_PROMPT` with this exact `ORACLE_SYSTEM_PROMPT`**

Replace the entire prompt constant with:

```ts
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
```

- [ ] **Step 3: Update the status enum usage and progress update states to the Oracle state names**

Replace any Finder-style status emission with these Oracle states:

```ts
emitProgress("initializing");
emitProgress("investigating");
emitProgress("reasoning");
emitProgress("synthesizing");
```

And make sure the final result uses:

```ts
status: "complete" as OracleStatus
```

and errors use:

```ts
status: "error" as OracleStatus
```

- [ ] **Step 4: Verify the new response format appears in a real run**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
pi -e ./oracle.ts -p "Use oracle to debug why the finder tool might stop too early"
```

Expected: The returned text includes `## Observation`, `## Hypothesis Table`, `## Evidence For`, and `## Discriminating Probe`.

- [ ] **Step 5: Commit the reasoning contract**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
git add oracle.ts
git commit -m "feat: add oracle reasoning prompt and response contract"
```

---

### Task 3: Adapt the progress widget and rendering for Oracle terminology

**Files:**
- Modify: `oracle.ts`

- [ ] **Step 1: Run the failing UI check so you can see the remaining Finder terminology**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
pi -e ./oracle.ts
```

Then ask:
```text
Use oracle to debug why auth middleware fails intermittently
```

Expected: The widget still shows Finder-specific copy such as `Finder Task - ...`, and the final error/success labels still refer to `finder`.

- [ ] **Step 2: Rename the widget classes and the singleton widget reference**

Replace the widget declarations with:

```ts
interface OracleToolEntry {
  id: string;
  toolName: string;
  label: string;
  status: "running" | "done";
  sequence: number;
  doneAt?: number;
  loader?: Loader;
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
```

- [ ] **Step 3: Replace the tool-label summarizer so Oracle emits reasoning-oriented labels**

Replace the label helper with:

```ts
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
```

- [ ] **Step 4: Update widget registration and final renderer labels from Finder to Oracle**

Make these exact replacements:

```ts
ctx.ui.setWidget("oracle", (tui, theme) => {
  oracleProgress = new OracleProgress(tui, theme, params.query);
  return oracleProgress;
}, { placement: "belowEditor" });
```

```ts
ctx.ui.setWidget("oracle", undefined);
oracleProgress?.dispose();
oracleProgress = null;
```

```ts
let output = `${theme.fg("error", "✗ oracle")}`;
```

Keep the final success renderer simple, the same way Finder does it:

```ts
return new Text(theme.fg("toolOutput", textContent), 0, 0);
```

- [ ] **Step 5: Run the interactive green check**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
pi -e ./oracle.ts
```

Then ask:
```text
Use oracle to reason about why the finder tool might stop too early
```

Expected: The widget headline begins with `Oracle - analyzing ...`, tool rows use reasoning-oriented labels, and error labels say `oracle` instead of `finder`.

- [ ] **Step 6: Commit the widget and rendering changes**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
git add oracle.ts
git commit -m "feat: adapt oracle progress widget and rendering"
```

---

### Task 4: Tune the execution loop for Oracle depth, evidence tracking, and forced synthesis

**Files:**
- Modify: `oracle.ts`

- [ ] **Step 1: Run the failing source check to confirm the file still has Finder-style limits**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
rg -n "MAX_TURNS|180_000|consecutiveTurnsWithNoNewFiles >= 2|filesFound" oracle.ts
```

Expected: The file still contains Finder's `MAX_TURNS = 10`, `180_000`, and `consecutiveTurnsWithNoNewFiles >= 2` style logic.

- [ ] **Step 2: Replace Finder's file-discovery tracking with Oracle evidence tracking**

Add this helper near the existing helpers section:

```ts
function extractEvidenceSources(text: string): string[] {
  const matches = text.match(/\/[^\s:]+(?:\.[a-zA-Z0-9]+)?(?::\d+)?/g) || [];
  return matches;
}
```

Then replace the execution-state setup with:

```ts
const evidenceSources = new Set<string>();
const filesRead = new Set<string>();
const commandsRun: { tool: string; input: unknown }[] = [];
let consecutiveTurnsWithNoNewEvidence = 0;
let turnCount = 0;
const MAX_TURNS = 15;
let forceSynthesisSent = false;
```

Update `emitProgress()` to publish Oracle details:

```ts
const emitProgress = (status: OracleStatus) => {
  if (!onUpdate) return;

  const recentTools = commandsRun.slice(-5).map((c) => ({
    tool: c.tool,
    input: formatToolInput(c.tool, c.input),
  }));

  onUpdate({
    content: [{ type: "text", text: "" }],
    details: {
      query: params.query,
      status,
      model: modelId,
      turnCount,
      maxTurns: MAX_TURNS,
      evidenceCount: evidenceSources.size,
      toolCalls: recentTools,
    } as OracleDetails,
  });
};
```

- [ ] **Step 3: Expand the timeout and plateau policy to Oracle values**

Replace the timeout setup with:

```ts
const timeoutId = setTimeout(() => timeoutAbort.abort(), 300_000);
```

Inside the `turn_end` subscriber, replace the Finder diminishing-returns logic with:

```ts
let foundNewEvidence = false;
for (const toolResult of turnEvent.toolResults || []) {
  const content = toolResult.content || [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      const extracted = extractEvidenceSources(block.text);
      for (const source of extracted) {
        if (!evidenceSources.has(source)) {
          evidenceSources.add(source);
          foundNewEvidence = true;
        }
      }
    }
  }
}

if (!foundNewEvidence && turnCount > 1) {
  consecutiveTurnsWithNoNewEvidence++;
} else {
  consecutiveTurnsWithNoNewEvidence = 0;
}

emitProgress(consecutiveTurnsWithNoNewEvidence > 0 ? "reasoning" : "investigating");

if (consecutiveTurnsWithNoNewEvidence >= 3 && !forceSynthesisSent) {
  forceSynthesisSent = true;
  emitProgress("synthesizing");
  oracleProgress?.clearTools();
  agent.steer({
    role: "user",
    content: [{
      type: "text",
      text: "Evidence has plateaued for 3 rounds. Synthesize your findings now. Rank the remaining hypotheses, state the best explanation, and include the single best discriminating probe. Do not make more tool calls.",
    }],
    timestamp: Date.now(),
  });
}

if (turnCount >= MAX_TURNS && !forceSynthesisSent) {
  forceSynthesisSent = true;
  emitProgress("synthesizing");
  oracleProgress?.clearTools();
  agent.steer({
    role: "user",
    content: [{
      type: "text",
      text: "Maximum reasoning turns reached. Synthesize your findings now using the required output format. Rank the remaining hypotheses and include the best discriminating probe.",
    }],
    timestamp: Date.now(),
  });
}
```

- [ ] **Step 4: Update final result details, timeout messaging, and model resolution calls to Oracle names**

Make these exact replacements:

```ts
const model = resolveOracleModel(ctx.modelRegistry) ?? ctx.model;
```

```ts
const getLogDetails = () => ({
  query: params.query,
  commandsRun: commandsRun.length,
  toolsUsed: [...new Set(commandsRun.map((c) => c.tool))],
  filesRead: [...filesRead],
  evidenceSources: [...evidenceSources],
  turns: turnCount,
});
```

```ts
const timeoutNote = isTimeout ? "\n\n(Reasoning timed out after 300s — results may be partial)" : "";
```

```ts
status: "complete" as OracleStatus,
evidenceCount: evidenceSources.size,
evidenceSources: [...evidenceSources],
```

```ts
status: "error" as OracleStatus,
evidenceCount: evidenceSources.size,
```

- [ ] **Step 5: Run the green checks for limits and synthesis**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
rg -n "MAX_TURNS = 15|300_000|consecutiveTurnsWithNoNewEvidence >= 3|evidenceCount" oracle.ts
```

Expected: All four Oracle-specific values appear in the file.

Then run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
pi -e ./oracle.ts -p "Use oracle to plan the safest way to refactor the finder tool without breaking its progress widget"
```

Expected: The subagent takes multiple reasoning turns and returns an Oracle-style report instead of Finder's file-oriented summary.

- [ ] **Step 6: Commit the execution-loop changes**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
git add oracle.ts
git commit -m "feat: tune oracle execution limits and evidence synthesis"
```

---

### Task 5: Document Oracle usage and run the final verification suite

**Files:**
- Modify: `README.md`
- Verify: `oracle.ts`

- [ ] **Step 1: Run the failing docs check to confirm README has no Oracle section yet**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
rg -n "Oracle|oracle.json|Use oracle" README.md
```

Expected: No matches.

- [ ] **Step 2: Update `README.md` to document Oracle alongside Finder**

Append this exact section to `README.md` after the existing Finder documentation:

````md
## Oracle Subagent

The `oracle` tool is a reasoning-focused sibling to Finder.

### What It Does

Oracle helps when the main agent is stuck on:
- tricky debugging problems
- ambiguous root-cause analysis
- trade-off-aware planning
- deciding the best next probe when evidence is incomplete

Unlike Finder, Oracle is not optimized for broad search. It is optimized for evidence-backed explanation.

### How Model Selection Works

The oracle resolves its model in this order:
1. `~/.pi/agent/oracle.json`
2. the active session model

Example config:

```json
{
  "model": "ollama/glm-5:cloud"
}
```

### Usage

Quick test:

```bash
pi -e ./oracle.ts
```

Example prompts:

```text
Use oracle to debug why auth middleware fails intermittently
Use oracle to reason about why the finder tool might stop too early
Use oracle to plan the safest way to refactor the finder progress widget
```

### Output Shape

Oracle returns:
- `## Observation`
- `## Hypothesis Table`
- `## Evidence For`
- `## Evidence Against / Gaps`
- `## Current Best Explanation`
- `## Recommendations`
- `## Discriminating Probe`
````

- [ ] **Step 3: Run the final verification suite**

Run these commands one at a time from the repo root:

```bash
pi -e ./oracle.ts -p "Use oracle to debug why auth middleware fails intermittently"
```

Expected: Output includes `## Observation` and `## Hypothesis Table`.

```bash
pi -e ./oracle.ts -p "Use oracle to reason about why the finder tool might stop too early"
```

Expected: Output includes evidence for and against at least two hypotheses.

```bash
pi -e ./oracle.ts -p "Use oracle to plan the safest way to refactor the finder progress widget"
```

Expected: Output includes recommendations and a discriminating probe, not implementation edits.

```bash
rg -n "name: \"oracle\"|label: \"Oracle\"|ORACLE_SYSTEM_PROMPT|MAX_TURNS = 15|300_000" oracle.ts
```

Expected: All Oracle-specific identifiers are present.

- [ ] **Step 4: Commit the docs and final verification results**

Run:
```bash
cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager
git add README.md oracle.ts
git commit -m "docs: add oracle usage and finalize oracle subagent"
```

---

## Self-Review Checklist

### Spec coverage

| Spec Requirement | Task |
|---|---|
| `oracle.ts` follows the same structure as `finder.ts` | Task 1 |
| Tool name/config path are Oracle-specific | Task 1 |
| Oracle is a deep reasoning agent for debugging and planning | Task 2 |
| Prompt is informed by debugger/tracer/architect research | Task 2 |
| Oracle uses read-heavy evidence tools plus bash for safe verification | Task 2 and Task 4 |
| Output format includes Observation / Hypothesis Table / Evidence / Best Explanation / Recommendations / Discriminating Probe | Task 2 |
| Progress widget uses Oracle terminology | Task 3 |
| Longer limits: 15 turns, 5 minutes, 3-turn plateau | Task 4 |
| Forced synthesis on plateau or limit | Task 4 |
| README documents Oracle usage/configuration | Task 5 |
| Final verification proves reasoning behavior, not search-only behavior | Task 5 |

### Placeholder scan
- No `TODO`, `TBD`, or "implement later" text remains.
- Every code-changing step includes exact replacement code.
- Every verification step includes the exact command and the expected result.

### Type consistency
- `OracleInput`, `OracleStatus`, `OracleDetails`, `OracleConfig`, `OracleProgress`, and `oracleProgress` are the only Oracle-specific names used.
- Model helpers use `loadOracleModelReference()` and `resolveOracleModel()` consistently.
- Progress and render code refer to `oracle`, not `finder`.
