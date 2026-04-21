# Manager + Worker Subagents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight `manager` and `worker` Pi subagents that complement the existing `finder` and `oracle` tools while preserving a strong token-cost to performance ratio.

**Architecture:** Keep the existing single-file extension pattern. Refactor `finder.ts` and `oracle.ts` to export reusable tool definitions, then build `worker.ts` and `manager.ts` on top of those definitions. `worker` is an implementation-focused subagent with one constrained `finder` fallback; `manager` is a read-only routing subagent that delegates to exactly one best-fit tool by default.

**Tech Stack:** TypeScript extensions for Pi, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@sinclair/typebox`, `@mariozechner/pi-tui`

---

## Scope and verification notes

This repo currently has no package manifest, no test runner, and no standalone unit-test harness. To keep scope aligned with the approved spec, this plan uses:

- deterministic extension load checks
- interactive/print-mode smoke tests with Pi
- focused exported helpers only where they materially simplify the implementation

Do **not** add a broad build/test toolchain in v1 unless implementation reveals a hard blocker.

## File Structure

### Files to modify
- Modify: `finder.ts`
- Modify: `oracle.ts`
- Modify: `README.md`

### Files to create
- Create: `manager.ts`
- Create: `worker.ts`

### Responsibilities
- `finder.ts` — existing search subagent; refactor to export a reusable tool definition without changing behavior
- `oracle.ts` — existing reasoning subagent; refactor to export a reusable tool definition without changing behavior
- `worker.ts` — new implementation subagent with coding tools plus a one-use `finder` fallback
- `manager.ts` — new routing subagent with access to `finder`, `oracle`, and `worker`; enforces single-delegate default behavior
- `README.md` — explain the 4-tool stack, usage, model config, and role boundaries

## Task 1: Refactor finder and oracle into reusable tool definitions

**Files:**
- Modify: `finder.ts`
- Modify: `oracle.ts`

### Why this task exists

`manager` must be able to delegate to `finder`, `oracle`, and `worker` from inside its own isolated `Agent` instance. The cleanest low-scope way to do that is to make the existing tools reusable as exported tool definitions instead of extension-only inline registrations.

### Implementation notes

Keep behavior unchanged. Only change how the tool is declared/exported.

### Task 1 code target

Refactor each file from:

```ts
export default function finderExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "finder",
    // ...
    async execute(...) {
      // existing implementation
    }
  });
}
```

To this shape:

```ts
import { defineTool } from "@mariozechner/pi-coding-agent";

export const finderTool = defineTool({
  name: "finder",
  label: "Finder",
  description: "Launch a specialized search subagent to find files, code patterns, and relationships in the codebase. The subagent uses parallel search strategies and returns structured findings.",
  promptSnippet: "Use finder for complex codebase searches requiring multi-turn exploration across multiple files and patterns.",
  promptGuidelines: [
    "Use finder when a simple grep or find would not be sufficient to understand the codebase structure.",
    "The finder subagent excels at tracing relationships between files, understanding data flows, and finding all usages of a pattern.",
  ],
  parameters: finderSchema,
  execute: executeFinder,
});

export default function finderExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
}
```

Where `executeFinder(...)` is the exact logic currently inside the inline `async execute(...)` implementation.

And similarly for oracle:

```ts
import { defineTool } from "@mariozechner/pi-coding-agent";

export const oracleTool = defineTool({
  name: "oracle",
  label: "Oracle",
  description: "Launch a deep-reasoning subagent for debugging tricky problems, ranking competing hypotheses, and planning nuanced changes.",
  promptSnippet: "Use oracle when you need deep reasoning for debugging, root-cause analysis, or trade-off-aware planning.",
  promptGuidelines: [
    "Use oracle when the main agent is stuck between multiple explanations and needs evidence-backed reasoning.",
    "The oracle subagent excels at debugging tricky failures, ranking hypotheses, and recommending the best next probe.",
  ],
  parameters: oracleSchema,
  execute: executeOracle,
});

export default function oracleExtension(pi: ExtensionAPI) {
  pi.registerTool(oracleTool);
}
```

Where `executeOracle(...)` is the exact logic currently inside the inline `async execute(...)` implementation.

### Steps

- [ ] **Step 1: Add `defineTool` import and export `finderTool` from `finder.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { defineTool, createFindTool, createGrepTool, createLsTool, createReadTool, createBashTool } from "@mariozechner/pi-coding-agent";
```

- [ ] **Step 2: Replace inline `pi.registerTool({ ... })` in `finder.ts` with `export const finderTool = defineTool({ ... })`**

```ts
async function executeFinder(toolCallId, params, signal, onUpdate, ctx) {
  return finderExecuteImplementation(toolCallId, params, signal, onUpdate, ctx);
}

export const finderTool = defineTool({
  name: "finder",
  label: "Finder",
  description: "Launch a specialized search subagent to find files, code patterns, and relationships in the codebase. The subagent uses parallel search strategies and returns structured findings.",
  promptSnippet: "Use finder for complex codebase searches requiring multi-turn exploration across multiple files and patterns.",
  promptGuidelines: [
    "Use finder when a simple grep or find would not be sufficient to understand the codebase structure.",
    "The finder subagent excels at tracing relationships between files, understanding data flows, and finding all usages of a pattern.",
  ],
  parameters: finderSchema,
  execute: executeFinder,
});
```

Implement `finderExecuteImplementation(...)` by extracting the current inline execute logic into a named helper in the same file.

- [ ] **Step 3: Re-register the exported `finderTool` in the default extension export**

```ts
export default function finderExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
}
```

- [ ] **Step 4: Apply the same refactor to `oracle.ts` as `export const oracleTool = defineTool({ ... })`**

```ts
import { defineTool, createFindTool, createGrepTool, createLsTool, createReadTool, createBashTool } from "@mariozechner/pi-coding-agent";

async function executeOracle(toolCallId, params, signal, onUpdate, ctx) {
  return oracleExecuteImplementation(toolCallId, params, signal, onUpdate, ctx);
}

export const oracleTool = defineTool({
  name: "oracle",
  label: "Oracle",
  description: "Launch a deep-reasoning subagent for debugging tricky problems, ranking competing hypotheses, and planning nuanced changes.",
  promptSnippet: "Use oracle when you need deep reasoning for debugging, root-cause analysis, or trade-off-aware planning.",
  promptGuidelines: [
    "Use oracle when the main agent is stuck between multiple explanations and needs evidence-backed reasoning.",
    "The oracle subagent excels at debugging tricky failures, ranking hypotheses, and recommending the best next probe.",
  ],
  parameters: oracleSchema,
  execute: executeOracle,
});

export default function oracleExtension(pi: ExtensionAPI) {
  pi.registerTool(oracleTool);
}
```

Implement `oracleExecuteImplementation(...)` by extracting the current inline execute logic into a named helper in the same file.

- [ ] **Step 5: Smoke-test that refactoring preserved existing behavior**

Run:

```bash
pi -e ./finder.ts
```

Prompt:

```text
Use finder to find where model resolution happens in this repo
```

Expected:
- tool loads successfully
- finder still returns structured `## Findings / ## Impact / ## Relationships / ## Recommendation / ## Next Steps`

Run:

```bash
pi -e ./oracle.ts
```

Prompt:

```text
Use oracle to reason about why finder has diminishing-return logic
```

Expected:
- tool loads successfully
- oracle still returns structured reasoning output

- [ ] **Step 6: Commit the refactor**

```bash
git add finder.ts oracle.ts
git commit -m "refactor: export reusable finder and oracle tools"
```

## Task 2: Implement `worker.ts`

**Files:**
- Create: `worker.ts`

### Why this task exists

`worker` is the focused implementation tool. It should reuse the isolated-subagent pattern, keep prompts thin, use the coding toolset, and allow exactly one `finder` fallback when blocked by codebase uncertainty.

### Design constraints to preserve
- user-facing and internally callable
- implementation-focused
- verification-first
- test-first when natural
- one `finder` fallback maximum
- no `oracle`
- no recursive delegation

### Worker file shape

Build `worker.ts` as a self-contained extension mirroring `finder.ts` / `oracle.ts`:
- config loader for `~/.pi/agent/worker.json`
- `WORKER_SYSTEM_PROMPT`
- compact progress widget
- `workerSchema`
- reusable `workerTool`
- default export that registers `workerTool`

### Task 2 code target

The new tool should look like this at the top level:

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  defineTool,
  createReadTool,
  createEditTool,
  createWriteTool,
  createBashTool,
} from "@mariozechner/pi-coding-agent";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { stream, type Model } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";
import { Text, Loader, type TUI, type Component } from "@mariozechner/pi-tui";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { finderTool } from "./finder.ts";
```

### Worker system prompt

Use a thin prompt, not a persona stack:

```ts
const WORKER_SYSTEM_PROMPT = `You are Worker, a focused implementation subagent.
Your job is to make the smallest viable code change that satisfies the task and verify the result before claiming success.
You may inspect files, edit code, write files, and run verification commands.
You are not a planner for other agents and you are not a broad codebase researcher.

## Workflow
1. Understand the requested behavior.
2. Read the relevant files before editing.
3. Prefer test-first when there is a natural existing test location or obvious test harness.
4. If no proportional test path exists, implement directly and verify with the strongest available command.
5. Keep the diff minimal and scoped.
6. If blocked by codebase uncertainty, you may call finder once.
7. Return concrete verification evidence.

## Constraints
- No oracle calls.
- No recursive delegation.
- Use finder only once and only when blocked by codebase uncertainty.
- Do not broaden scope.
- Do not claim success without verification evidence.

## Output Format
## Status
## Summary
## Files Changed
## Verification
## Fallback Used
## Next Step`;
```

### Worker fallback wrapper

Wrap `finderTool` so the internal subagent can only use it once:

```ts
function createSingleUseFinderTool(): AgentTool {
  let used = false;

  return defineTool({
    ...finderTool,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (used) {
        return {
          content: [{ type: "text", text: "Error: finder fallback already used for this worker task." }],
          details: { error: "finder_fallback_exhausted" },
          isError: true,
        };
      }
      used = true;
      return finderTool.execute(toolCallId, params, signal, onUpdate, ctx);
    },
  }) as AgentTool;
}
```

### Steps

- [ ] **Step 1: Create `worker.ts` with imports, config loader, schema, and prompt**

```ts
interface WorkerConfig {
  model: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "worker.json");

function loadWorkerModelReference(): string | null {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed: WorkerConfig = JSON.parse(raw);
    return parsed.model || null;
  } catch {
    return null;
  }
}

let cachedWorkerModel: Model<any> | null = null;

function resolveWorkerModel(modelRegistry: any): Model<any> | null {
  if (cachedWorkerModel) return cachedWorkerModel;
  const modelRef = loadWorkerModelReference();
  if (!modelRef) return null;
  const [provider, modelId] = modelRef.split("/");
  if (!provider || !modelId) return null;
  const model = modelRegistry.find(provider, modelId);
  if (!model) return null;
  cachedWorkerModel = model as Model<any>;
  return cachedWorkerModel;
}

const workerSchema = Type.Object({
  task: Type.String({ description: "Implementation task to execute" }),
});

type WorkerInput = Static<typeof workerSchema>;
```

- [ ] **Step 2: Add a compact worker progress widget instead of copying the full finder/oracle widget complexity**

```ts
class WorkerProgress implements Component {
  constructor(
    private tui: TUI,
    private theme: { fg: (color: string, text: string) => string },
    private task: string,
    private loader: Loader = new Loader(tui, theme.fg.bind(theme, "accent"), theme.fg.bind(theme, "muted"), `Worker - ${task}`),
    private recentTools: string[] = [],
  ) {}

  addTool(label: string): void {
    this.recentTools.push(label);
    if (this.recentTools.length > 4) this.recentTools.shift();
    this.tui.requestRender();
  }

  dispose(): void {
    this.loader.stop();
  }

  render(width: number): string[] {
    const lines = [...this.loader.render(width)];
    for (const tool of this.recentTools) {
      lines.push(new Text(`- ${tool}`, 0, 0).render(width)[0] ?? "");
    }
    return lines;
  }

  invalidate(): void {}
}
```

- [ ] **Step 3: Build the worker subagent toolset with coding tools plus one wrapped finder fallback**

```ts
const subagentTools: AgentTool[] = [
  createReadTool(ctx.cwd),
  createEditTool(ctx.cwd),
  createWriteTool(ctx.cwd),
  createBashTool(ctx.cwd),
  createSingleUseFinderTool(),
];
```

- [ ] **Step 4: Implement `workerTool` using the same isolated-agent pattern as finder/oracle**

```ts
export const workerTool = defineTool({
  name: "worker",
  label: "Worker",
  description: "Launch a focused implementation subagent that makes small code changes, verifies them, and may use finder once when blocked by codebase uncertainty.",
  promptSnippet: "Use worker for focused implementation tasks that need code edits and verification.",
  promptGuidelines: [
    "Use worker for direct implementation work with minimal diffs and concrete verification.",
    "Worker may use finder once when blocked by codebase uncertainty, but does not use oracle or recursively delegate.",
  ],
  parameters: workerSchema,
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    if (!params.task || params.task.trim().length === 0) {
      return {
        content: [{ type: "text", text: "Error: Please provide a non-empty task." }],
        details: { error: "empty_task" },
        isError: true,
      };
    }

    const model = resolveWorkerModel(ctx.modelRegistry) ?? ctx.model;
    if (!model) {
      return {
        content: [{ type: "text", text: "Error: No model available for worker subagent.\n\nTroubleshooting:\n  1. Create/edit ~/.pi/agent/worker.json with: {\"model\": \"provider/modelId\"}\n  2. Or set a session model with: /model provider/modelId" }],
        details: { error: "no_model", configPath: CONFIG_PATH },
        isError: true,
      };
    }

    const modelId = `${model.provider}/${model.id}`;
    const timeoutAbort = new AbortController();
    const timeoutId = setTimeout(() => timeoutAbort.abort(), 240_000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutAbort.signal]) : timeoutAbort.signal;

    const resolvedAuth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!resolvedAuth.ok) {
      clearTimeout(timeoutId);
      return {
        content: [{ type: "text", text: `Error: Failed to resolve auth for model ${modelId}: ${resolvedAuth.error}` }],
        details: { error: "auth_resolution_failed", authError: resolvedAuth.error },
        isError: true,
      };
    }

    let finderFallbackUsed = false;
    const wrappedFinder = defineTool({
      ...finderTool,
      async execute(innerToolCallId, innerParams, innerSignal, innerOnUpdate, innerCtx) {
        finderFallbackUsed = true;
        return createSingleUseFinderTool().execute(innerToolCallId, innerParams, innerSignal, innerOnUpdate, innerCtx);
      },
    }) as AgentTool;

    const subagentTools: AgentTool[] = [
      createReadTool(ctx.cwd),
      createEditTool(ctx.cwd),
      createWriteTool(ctx.cwd),
      createBashTool(ctx.cwd),
      wrappedFinder,
    ];

    let workerProgress: WorkerProgress | undefined;
    ctx.ui.setWidget("worker", (tui, theme) => {
      workerProgress = new WorkerProgress(tui, theme, params.task);
      return workerProgress;
    }, { placement: "belowEditor" });

    const agent = new Agent({
      initialState: {
        systemPrompt: WORKER_SYSTEM_PROMPT,
        model,
        tools: subagentTools,
      },
      streamFn: (messages, context, opts) => stream(messages, context, {
        ...opts,
        signal: combinedSignal,
        apiKey: resolvedAuth.apiKey,
        headers: resolvedAuth.headers,
      }),
    });

    agent.subscribe((event) => {
      if (event.type === "tool_execution_start") {
        const toolName = (event as { toolName: string }).toolName;
        workerProgress?.addTool(toolName);
      }
    });

    try {
      await agent.prompt({
        role: "user",
        content: [{ type: "text", text: params.task }],
        timestamp: Date.now(),
      });
      await agent.waitForIdle();

      const finalMessage = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
      const finalText = finalMessage?.content
        ?.filter((block): block is { type: "text"; text: string } => block.type === "text" && "text" in block)
        .map((block) => block.text)
        .join("\n")
        .trim() || "Error: Worker subagent did not return a response.";

      return buildWorkerResult(finalText, finderFallbackUsed);
    } finally {
      clearTimeout(timeoutId);
      workerProgress?.dispose();
      ctx.ui.setWidget("worker", null);
    }
  },
});

export default function workerExtension(pi: ExtensionAPI) {
  pi.registerTool(workerTool);
}
```

- [ ] **Step 5: Use worker-specific result formatting**

```ts
function buildWorkerResult(text: string, usedFinderFallback: boolean) {
  return {
    content: [{ type: "text", text }],
    details: {
      fallbackUsed: usedFinderFallback,
    },
  };
}
```

- [ ] **Step 6: Smoke-test direct worker usage**

Run:

```bash
pi -e ./finder.ts -e ./worker.ts
```

Prompt:

```text
Use worker to inspect README.md and propose the smallest safe wording change for manager/worker docs, but do not make any edits.
```

Expected:
- tool loads successfully
- worker responds in the `## Status / ## Summary / ## Files Changed / ## Verification / ## Fallback Used / ## Next Step` structure
- worker does not require oracle

Run:

```bash
pi -e ./finder.ts -e ./worker.ts
```

Prompt:

```text
Use worker to identify where the README should be updated for manager and worker usage, and use finder only if needed.
```

Expected:
- worker can complete the task
- at most one internal finder invocation occurs

- [ ] **Step 7: Commit `worker.ts`**

```bash
git add worker.ts
git commit -m "feat: add worker implementation subagent"
```

## Task 3: Implement `manager.ts`

**Files:**
- Create: `manager.ts`

### Why this task exists

`manager` is the thin routing layer. It should remain read-only, classify task shape, and delegate to exactly one best-fit tool by default. It should not become an expensive planner or multi-agent orchestrator in v1.

### Design constraints to preserve
- read-only
- user-facing and internal
- balanced personality
- single-delegate by default
- auto-route clear implementation tasks
- no `finder -> oracle -> worker` chaining in v1

### Manager file shape

Build `manager.ts` as a self-contained extension with:
- config loader for `~/.pi/agent/manager.json`
- `MANAGER_SYSTEM_PROMPT`
- compact manager progress widget
- `managerSchema`
- reusable `managerTool`
- default export that registers `managerTool`

### Manager system prompt

Keep it short and directive:

```ts
const MANAGER_SYSTEM_PROMPT = `You are Manager, a lightweight routing subagent.
Your job is to classify the user's request and choose the single best next delegate by default.
You are read-only. You do not edit files or implement changes yourself.

## Task Shapes
- search
- reasoning
- implementation
- ambiguous

## Routing Policy
- search -> finder
- reasoning -> oracle
- implementation -> worker
- ambiguous -> ask one clarifying question or recommend the best next agent

## Constraints
- Single delegate by default.
- Do not chain finder -> oracle -> worker in v1.
- Auto-route clear implementation tasks to worker.
- Keep the routing summary short.

## Output Format
## Task Shape
## Decision
## Why
## Action Taken
## Next Step`;
```

### Single-delegation wrapper

Wrap the delegated tools so the manager subagent can invoke at most one of them:

```ts
function createOneShotDelegationTools(): AgentTool[] {
  let delegated = false;

  const wrap = (tool: AgentTool): AgentTool =>
    defineTool({
      ...tool,
      async execute(toolCallId, params, signal, onUpdate, ctx) {
        if (delegated) {
          return {
            content: [{ type: "text", text: "Error: manager already delegated once for this task." }],
            details: { error: "delegation_budget_exhausted" },
            isError: true,
          };
        }
        delegated = true;
        return tool.execute(toolCallId, params, signal, onUpdate, ctx);
      },
    }) as AgentTool;

  return [wrap(finderTool as AgentTool), wrap(oracleTool as AgentTool), wrap(workerTool as AgentTool)];
}
```

### Steps

- [ ] **Step 1: Create `manager.ts` with imports, config loader, schema, and prompt**

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { stream, type Model } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";
import { Loader, type TUI, type Component } from "@mariozechner/pi-tui";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { finderTool } from "./finder.ts";
import { oracleTool } from "./oracle.ts";
import { workerTool } from "./worker.ts";

interface ManagerConfig {
  model: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "manager.json");
const managerSchema = Type.Object({
  query: Type.String({ description: "Task to classify and route" }),
});
type ManagerInput = Static<typeof managerSchema>;
```

- [ ] **Step 2: Add a compact manager progress widget**

```ts
class ManagerProgress implements Component {
  constructor(
    private tui: TUI,
    private theme: { fg: (color: string, text: string) => string },
    private query: string,
    private loader: Loader = new Loader(tui, theme.fg.bind(theme, "accent"), theme.fg.bind(theme, "muted"), `Manager - ${query}`),
    private statusLine: string = "classifying",
  ) {}

  setStatus(status: string): void {
    this.statusLine = status;
    this.tui.requestRender();
  }

  dispose(): void {
    this.loader.stop();
  }

  render(width: number): string[] {
    return [
      ...this.loader.render(width),
      `${this.theme.fg("dim", "status:")} ${this.statusLine}`,
    ];
  }

  invalidate(): void {}
}
```

- [ ] **Step 3: Build `managerTool` with one-shot delegation tools and the standard isolated-agent flow**

```ts
export const managerTool = defineTool({
  name: "manager",
  label: "Manager",
  description: "Launch a lightweight routing subagent that classifies a task and delegates to finder, oracle, or worker.",
  promptSnippet: "Use manager when you want a lightweight read-only router to choose the best next specialized subagent.",
  promptGuidelines: [
    "Use manager when the task may need routing to finder, oracle, or worker.",
    "Manager is read-only and delegates to exactly one best-fit subagent by default.",
  ],
  parameters: managerSchema,
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    if (!params.query || params.query.trim().length === 0) {
      return {
        content: [{ type: "text", text: "Error: Please provide a non-empty query." }],
        details: { error: "empty_query" },
        isError: true,
      };
    }

    const model = resolveManagerModel(ctx.modelRegistry) ?? ctx.model;
    if (!model) {
      return {
        content: [{ type: "text", text: "Error: No model available for manager subagent.\n\nTroubleshooting:\n  1. Create/edit ~/.pi/agent/manager.json with: {\"model\": \"provider/modelId\"}\n  2. Or set a session model with: /model provider/modelId" }],
        details: { error: "no_model", configPath: CONFIG_PATH },
        isError: true,
      };
    }

    const modelId = `${model.provider}/${model.id}`;
    const timeoutAbort = new AbortController();
    const timeoutId = setTimeout(() => timeoutAbort.abort(), 120_000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutAbort.signal]) : timeoutAbort.signal;

    const resolvedAuth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!resolvedAuth.ok) {
      clearTimeout(timeoutId);
      return {
        content: [{ type: "text", text: `Error: Failed to resolve auth for model ${modelId}: ${resolvedAuth.error}` }],
        details: { error: "auth_resolution_failed", authError: resolvedAuth.error },
        isError: true,
      };
    }

    const subagentTools = createOneShotDelegationTools();

    let managerProgress: ManagerProgress | undefined;
    ctx.ui.setWidget("manager", (tui, theme) => {
      managerProgress = new ManagerProgress(tui, theme, params.query);
      return managerProgress;
    }, { placement: "belowEditor" });

    const agent = new Agent({
      initialState: {
        systemPrompt: MANAGER_SYSTEM_PROMPT,
        model,
        tools: subagentTools,
      },
      streamFn: (messages, context, opts) => stream(messages, context, {
        ...opts,
        signal: combinedSignal,
        apiKey: resolvedAuth.apiKey,
        headers: resolvedAuth.headers,
      }),
    });

    agent.subscribe((event) => {
      if (event.type === "tool_execution_start") {
        managerProgress?.setStatus(`delegating to ${(event as { toolName: string }).toolName}`);
      }
      if (event.type === "turn_end") {
        managerProgress?.setStatus("synthesizing result");
      }
    });

    try {
      await agent.prompt({
        role: "user",
        content: [{ type: "text", text: params.query }],
        timestamp: Date.now(),
      });
      await agent.waitForIdle();

      const finalMessage = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
      const finalText = finalMessage?.content
        ?.filter((block): block is { type: "text"; text: string } => block.type === "text" && "text" in block)
        .map((block) => block.text)
        .join("\n")
        .trim() || "Error: Manager subagent did not return a response.";

      return {
        content: [{ type: "text", text: finalText }],
        details: { delegated: true },
      };
    } finally {
      clearTimeout(timeoutId);
      managerProgress?.dispose();
      ctx.ui.setWidget("manager", null);
    }
  },
});

export default function managerExtension(pi: ExtensionAPI) {
  pi.registerTool(managerTool);
}
```

- [ ] **Step 4: Ensure manager can answer directly without delegation when the task is ambiguous**

```ts
// No extra tool required.
// The prompt should allow the Agent to return a direct short answer when the task is ambiguous.
// Do not force a tool call if one is not warranted.
```

- [ ] **Step 5: Smoke-test routing across all three paths**

Run:

```bash
pi -e ./finder.ts -e ./oracle.ts -e ./worker.ts -e ./manager.ts
```

Prompt:

```text
Use manager to find where finder resolves its model configuration
```

Expected:
- manager delegates to finder
- returned result contains a short routing summary plus finder-style findings

Prompt:

```text
Use manager to reason about whether worker should call oracle directly
```

Expected:
- manager delegates to oracle
- returned result contains a short routing summary plus oracle-style reasoning

Prompt:

```text
Use manager to implement the README changes for manager and worker usage
```

Expected:
- manager delegates directly to worker
- manager does not chain through finder/oracle first

- [ ] **Step 6: Commit `manager.ts`**

```bash
git add manager.ts
git commit -m "feat: add manager routing subagent"
```

## Task 4: Update README for the 4-tool stack

**Files:**
- Modify: `README.md`

### Why this task exists

The repo README currently documents `finder` and `oracle` only. After adding `manager` and `worker`, the README must explain the new roles, model config files, usage, and how they differ.

### README changes to make
- explain the 4-tool stack
- document `manager` and `worker`
- explain default routing responsibilities
- add `~/.pi/agent/manager.json` and `~/.pi/agent/worker.json`
- add usage examples
- keep the README concise and aligned with the lightweight design philosophy

### README excerpt to add

```md
## Manager Subagent

The `manager` tool is a lightweight read-only router.

It decides whether a request is best handled by:
- `finder` for search and codebase exploration
- `oracle` for debugging / reasoning / trade-off analysis
- `worker` for focused implementation work

The manager delegates to one best-fit subagent by default.

### Worker Subagent

The `worker` tool is a focused implementation subagent.

It:
- reads relevant code
- makes the smallest viable change
- verifies results before claiming success
- may use `finder` once if blocked by codebase uncertainty

It does not call `oracle` and does not recursively delegate.
```

### Steps

- [ ] **Step 1: Add manager documentation to `README.md`**

```md
## Manager Subagent

The `manager` tool is a lightweight read-only router for Pi subagents.

Use it when you want the system to choose the best next specialized tool:
- `finder` for search and codebase exploration
- `oracle` for debugging, reasoning, and trade-off analysis
- `worker` for focused implementation work

The manager delegates to one best-fit subagent by default.
```

- [ ] **Step 2: Add worker documentation to `README.md`**

```md
## Worker Subagent

The `worker` tool is a focused implementation subagent.

It:
- reads relevant code
- makes the smallest viable change
- verifies results before claiming success
- may use `finder` once if blocked by codebase uncertainty

It does not call `oracle` and does not recursively delegate.
```

- [ ] **Step 3: Add model config examples**

~~~md
### Manager model config

```json
{
  "model": "ollama/glm-5:cloud"
}
```

Path: `~/.pi/agent/manager.json`

### Worker model config

```json
{
  "model": "ollama/glm-5:cloud"
}
```

Path: `~/.pi/agent/worker.json`
~~~

- [ ] **Step 4: Add usage examples**

```md
Use manager to decide how to approach adding a retry policy to finder
Use manager to route this implementation task
Use worker to make the smallest possible fix and verify it
Use worker to implement the README updates for manager and worker
```

- [ ] **Step 5: Smoke-test the documented commands manually**

Run:

```bash
pi -e ./finder.ts -e ./oracle.ts -e ./worker.ts -e ./manager.ts
```

Try at least one prompt for each tool from the README examples.

Expected:
- all four tools load successfully
- examples match actual behavior

- [ ] **Step 6: Commit the docs update**

```bash
git add README.md
git commit -m "docs: add manager and worker usage"
```

## Final verification

- [ ] **Step 1: Run a full manual smoke session with all four tools loaded**

Run:

```bash
pi -e ./finder.ts -e ./oracle.ts -e ./worker.ts -e ./manager.ts
```

Verify the following prompts:

```text
Use finder to find where worker loads its model config
Use oracle to reason about whether manager should multi-delegate in v1
Use worker to inspect README.md and suggest the smallest wording fix
Use manager to decide how to approach documenting the four-tool stack
```

Expected:
- each tool loads
- each tool stays within its role
- manager delegates once at most
- worker never uses oracle
- worker finder fallback remains bounded

- [ ] **Step 2: Inspect git diff for unintended changes**

```bash
git diff -- finder.ts oracle.ts worker.ts manager.ts README.md
```

Expected:
- changes are limited to the planned files
- no unrelated edits

- [ ] **Step 3: Create final integration commit if tasks were amended during verification**

```bash
git add finder.ts oracle.ts worker.ts manager.ts README.md
git commit -m "feat: add manager and worker subagents"
```

## Spec coverage self-review

- `manager` added as a read-only router: covered by Task 3
- `worker` added as an implementation tool: covered by Task 2
- `finder` and `oracle` preserved: covered by Task 1
- single-file extension pattern preserved: covered by Tasks 2 and 3
- one-fallback worker behavior: covered by Task 2
- one-delegate manager behavior: covered by Task 3
- README/docs updated: covered by Task 4

## Placeholder scan self-review

No TODO/TBD placeholders remain. Where existing infrastructure is absent, the plan explicitly uses smoke tests instead of inventing an unapproved test stack.

## Type/shape consistency self-review

The plan consistently uses these names:
- `finderTool`
- `oracleTool`
- `workerTool`
- `managerTool`
- `manager(query: string)`
- `worker(task: string)`

It consistently preserves the 4-file extension layout plus README updates.
