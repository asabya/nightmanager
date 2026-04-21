# Subagents Package Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the repo into a proper TypeScript + Pi package with modular source layout, real tests, a combined extension entrypoint, and the new `manager`/`worker` tools.

**Architecture:** Build a conventional package layout with `src/`, `tests/`, and `dist/`. Migrate the existing `finder` and `oracle` implementations into `src/tools/`, extract shared logic into `src/core/`, register all four tools from `src/index.ts`, and validate the package with unit, integration, and CLI smoke tests.

**Tech Stack:** TypeScript, Vitest, Node ESM, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`, `@sinclair/typebox`

---

## File Structure

### Files to create
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `index.ts`
- `src/index.ts`
- `src/types/shared.ts`
- `src/core/models.ts`
- `src/core/result.ts`
- `src/core/routing.ts`
- `src/core/subagent.ts`
- `src/core/prompts.ts`
- `src/core/progress.ts`
- `src/tools/finder.ts`
- `src/tools/oracle.ts`
- `src/tools/worker.ts`
- `src/tools/manager.ts`
- `tests/unit/models.test.ts`
- `tests/unit/result.test.ts`
- `tests/unit/routing.test.ts`
- `tests/integration/entrypoint.test.ts`
- `tests/integration/manager.test.ts`
- `tests/integration/worker.test.ts`
- `tests/e2e/cli-smoke.test.ts`

### Files to modify
- `README.md`

### Files to remove after migration
- `finder.ts`
- `oracle.ts`

### Responsibilities
- `package.json` — package metadata, Pi manifest, scripts, deps
- `tsconfig.json` — TypeScript build settings for ESM and `dist/`
- `vitest.config.ts` — test project config for unit/integration/e2e groups
- `index.ts` — root dev shim for `pi -e ./index.ts`
- `src/index.ts` — combined Pi extension entrypoint registering all tools
- `src/core/models.ts` — config parsing + model resolution
- `src/core/result.ts` — final text/result extraction helpers
- `src/core/routing.ts` — manager task classification and delegate choice
- `src/core/subagent.ts` — isolated `Agent` runner helper
- `src/core/prompts.ts` — lightweight role-specific prompts
- `src/core/progress.ts` — shared compact progress components/helpers
- `src/tools/*` — tool definitions for finder/oracle/worker/manager
- `tests/unit/*` — pure/helper logic tests
- `tests/integration/*` — in-process package/tool tests
- `tests/e2e/*` — `pi -e` smoke tests
- `README.md` — package usage and install docs

## Task 1: Scaffold the package and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `index.ts`
- Create: `src/index.ts`
- Create: `src/types/shared.ts`

- [ ] **Step 1: Write the failing package metadata test by asserting the package files do not exist yet**

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("package scaffold", () => {
  it("creates the package entry files", () => {
    expect(existsSync(resolve(process.cwd(), "package.json"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "vitest.config.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "index.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/index.ts"))).toBe(true);
  });
});
```

- [ ] **Step 2: Save that as `tests/integration/entrypoint.test.ts` and run it to verify RED**

Run:

```bash
mkdir -p tests/integration && cat > tests/integration/entrypoint.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("package scaffold", () => {
  it("creates the package entry files", () => {
    expect(existsSync(resolve(process.cwd(), "package.json"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "vitest.config.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "index.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/index.ts"))).toBe(true);
  });
});
EOF
npx vitest run tests/integration/entrypoint.test.ts
```

Expected: FAIL because the scaffold files do not exist yet.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "subagents",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Finder, Oracle, Manager, and Worker subagents for Pi",
  "keywords": ["pi-package", "pi", "pi-coding-agent", "extension", "subagents"],
  "license": "MIT",
  "exports": {
    ".": "./dist/src/index.js"
  },
  "files": [
    "dist",
    "index.ts",
    "README.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e"
  },
  "peerDependencies": {
    "@mariozechner/pi-ai": "*",
    "@mariozechner/pi-agent-core": "*",
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*",
    "@sinclair/typebox": "*"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  },
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["index.ts", "src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: false,
  },
});
```

- [ ] **Step 6: Create the root and src entrypoints**

```ts
// index.ts
export { default } from "./src/index.js";
```

```ts
// src/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function subagentsExtension(_pi: ExtensionAPI) {
  // tools registered in later tasks
}
```

- [ ] **Step 7: Create a shared placeholder type file to keep imports stable**

```ts
// src/types/shared.ts
export type TaskShape = "search" | "reasoning" | "implementation" | "ambiguous";
export type DelegateTool = "finder" | "oracle" | "worker";
```

- [ ] **Step 8: Install dev dependencies**

Run:

```bash
npm install
```

Expected: package-lock.json created, dependencies installed successfully.

- [ ] **Step 9: Run the integration scaffold test to verify GREEN**

Run:

```bash
npx vitest run tests/integration/entrypoint.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts index.ts src tests
git commit -m "chore: scaffold TypeScript Pi package"
```

## Task 2: Extract shared core modules with unit tests

**Files:**
- Create: `src/core/models.ts`
- Create: `src/core/result.ts`
- Create: `src/core/routing.ts`
- Create: `src/core/subagent.ts`
- Create: `src/core/prompts.ts`
- Create: `src/core/progress.ts`
- Create: `tests/unit/models.test.ts`
- Create: `tests/unit/result.test.ts`
- Create: `tests/unit/routing.test.ts`

- [ ] **Step 1: Write the failing routing unit test**

```ts
import { describe, expect, it } from "vitest";
import { classifyTaskShape, chooseDelegate } from "../../src/core/routing.js";

describe("routing", () => {
  it("classifies implementation tasks", () => {
    expect(classifyTaskShape("implement the retry logic in finder")).toBe("implementation");
  });

  it("classifies reasoning tasks", () => {
    expect(classifyTaskShape("debug why finder stops too early")).toBe("reasoning");
  });

  it("classifies search tasks", () => {
    expect(classifyTaskShape("find where oracle resolves its model")).toBe("search");
  });

  it("chooses the correct delegate", () => {
    expect(chooseDelegate("implementation")).toBe("worker");
    expect(chooseDelegate("reasoning")).toBe("oracle");
    expect(chooseDelegate("search")).toBe("finder");
  });
});
```

- [ ] **Step 2: Run the routing test to verify RED**

Run:

```bash
mkdir -p tests/unit && cat > tests/unit/routing.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { classifyTaskShape, chooseDelegate } from "../../src/core/routing.js";

describe("routing", () => {
  it("classifies implementation tasks", () => {
    expect(classifyTaskShape("implement the retry logic in finder")).toBe("implementation");
  });

  it("classifies reasoning tasks", () => {
    expect(classifyTaskShape("debug why finder stops too early")).toBe("reasoning");
  });

  it("classifies search tasks", () => {
    expect(classifyTaskShape("find where oracle resolves its model")).toBe("search");
  });

  it("chooses the correct delegate", () => {
    expect(chooseDelegate("implementation")).toBe("worker");
    expect(chooseDelegate("reasoning")).toBe("oracle");
    expect(chooseDelegate("search")).toBe("finder");
  });
});
EOF
npx vitest run tests/unit/routing.test.ts
```

Expected: FAIL because `src/core/routing.ts` does not exist yet.

- [ ] **Step 3: Implement `src/core/routing.ts` minimally**

```ts
import type { DelegateTool, TaskShape } from "../types/shared.js";

const SEARCH_RE = /\b(find|where|locate|search|trace)\b/i;
const REASONING_RE = /\b(debug|why|reason|root cause|trade-?off|hypothesis|plan the safest)\b/i;
const IMPLEMENTATION_RE = /\b(implement|add|change|edit|update|fix|refactor|write)\b/i;

export function classifyTaskShape(input: string): TaskShape {
  const text = input.trim();
  if (text.length === 0) return "ambiguous";
  if (SEARCH_RE.test(text)) return "search";
  if (REASONING_RE.test(text)) return "reasoning";
  if (IMPLEMENTATION_RE.test(text)) return "implementation";
  return "ambiguous";
}

export function chooseDelegate(shape: Exclude<TaskShape, "ambiguous">): DelegateTool {
  if (shape === "search") return "finder";
  if (shape === "reasoning") return "oracle";
  return "worker";
}
```

- [ ] **Step 4: Write the failing models unit test**

```ts
import { describe, expect, it } from "vitest";
import { parseModelReference } from "../../src/core/models.js";

describe("models", () => {
  it("parses provider/model references", () => {
    expect(parseModelReference("ollama/glm-5:cloud")).toEqual({ provider: "ollama", modelId: "glm-5:cloud" });
  });

  it("rejects invalid model references", () => {
    expect(parseModelReference("invalid")).toBeNull();
  });
});
```

- [ ] **Step 5: Run the models test to verify RED**

Run:

```bash
cat > tests/unit/models.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { parseModelReference } from "../../src/core/models.js";

describe("models", () => {
  it("parses provider/model references", () => {
    expect(parseModelReference("ollama/glm-5:cloud")).toEqual({ provider: "ollama", modelId: "glm-5:cloud" });
  });

  it("rejects invalid model references", () => {
    expect(parseModelReference("invalid")).toBeNull();
  });
});
EOF
npx vitest run tests/unit/models.test.ts
```

Expected: FAIL because `src/core/models.ts` does not exist yet.

- [ ] **Step 6: Implement `src/core/models.ts` minimally**

```ts
import { existsSync, readFileSync } from "node:fs";

export interface ToolConfig {
  model?: string;
}

export interface ParsedModelReference {
  provider: string;
  modelId: string;
}

export function parseModelReference(input: string): ParsedModelReference | null {
  const parts = input.split("/");
  if (parts.length < 2) return null;
  const [provider, ...rest] = parts;
  const modelId = rest.join("/");
  if (!provider || !modelId) return null;
  return { provider, modelId };
}

export function loadToolConfig(configPath: string): ToolConfig | null {
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as ToolConfig;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Write the failing result unit test**

```ts
import { describe, expect, it } from "vitest";
import { extractFinalText } from "../../src/core/result.js";

describe("result helpers", () => {
  it("extracts text blocks from assistant messages", () => {
    expect(extractFinalText([
      { role: "assistant", content: [{ type: "text", text: "hello" }] },
    ])).toBe("hello");
  });
});
```

- [ ] **Step 8: Run the result test to verify RED**

Run:

```bash
cat > tests/unit/result.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { extractFinalText } from "../../src/core/result.js";

describe("result helpers", () => {
  it("extracts text blocks from assistant messages", () => {
    expect(extractFinalText([
      { role: "assistant", content: [{ type: "text", text: "hello" }] },
    ])).toBe("hello");
  });
});
EOF
npx vitest run tests/unit/result.test.ts
```

Expected: FAIL because `src/core/result.ts` does not exist yet.

- [ ] **Step 9: Implement `src/core/result.ts` minimally**

```ts
export function extractFinalText(messages: Array<{ role: string; content?: Array<{ type: string; text?: string }> }>): string {
  const finalAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  if (!finalAssistant?.content) return "";
  return finalAssistant.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}
```

- [ ] **Step 10: Add initial placeholder implementations for `src/core/subagent.ts`, `src/core/prompts.ts`, and `src/core/progress.ts` to keep later imports stable**

```ts
// src/core/prompts.ts
export const BASE_PROMPT = "Return concise, evidence-backed results.";
```

```ts
// src/core/progress.ts
export class NoopProgress {
  addTool(_toolName: string): void {}
  setStatus(_status: string): void {}
  dispose(): void {}
}
```

```ts
// src/core/subagent.ts
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { stream, type Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { extractFinalText } from "./result.js";

export async function runIsolatedSubagent(options: {
  ctx: ExtensionContext;
  model: Model<any>;
  systemPrompt: string;
  tools: AgentTool[];
  task: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<string> {
  const timeoutAbort = new AbortController();
  const timeoutId = setTimeout(() => timeoutAbort.abort(), options.timeoutMs);
  const combinedSignal = options.signal ? AbortSignal.any([options.signal, timeoutAbort.signal]) : timeoutAbort.signal;

  try {
    const resolvedAuth = await options.ctx.modelRegistry.getApiKeyAndHeaders(options.model);
    if (!resolvedAuth.ok) throw new Error(resolvedAuth.error);

    const agent = new Agent({
      initialState: {
        systemPrompt: options.systemPrompt,
        model: options.model,
        tools: options.tools,
      },
      streamFn: (messages, context, streamOptions) => stream(messages, context, {
        ...streamOptions,
        signal: combinedSignal,
        apiKey: resolvedAuth.apiKey,
        headers: resolvedAuth.headers,
      }),
    });

    await agent.prompt({
      role: "user",
      content: [{ type: "text", text: options.task }],
      timestamp: Date.now(),
    });
    await agent.waitForIdle();
    return extractFinalText(agent.state.messages);
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 11: Run all unit tests to verify GREEN**

Run:

```bash
npx vitest run tests/unit
```

Expected: PASS.

- [ ] **Step 12: Commit the core modules**

```bash
git add src/core src/types tests/unit
git commit -m "feat: add shared core modules and unit tests"
```

## Task 3: Migrate `finder` and `oracle` into `src/tools/` and register them from `src/index.ts`

**Files:**
- Create: `src/tools/finder.ts`
- Create: `src/tools/oracle.ts`
- Modify: `src/index.ts`
- Remove: `finder.ts`
- Remove: `oracle.ts`

- [ ] **Step 1: Write the failing combined-entrypoint integration test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("combined entrypoint", () => {
  it("registers finder and oracle tool modules", () => {
    const source = readFileSync("src/index.ts", "utf-8");
    expect(source).toContain("finderTool");
    expect(source).toContain("oracleTool");
  });
});
```

- [ ] **Step 2: Run that test to verify RED**

Run:

```bash
cat > tests/integration/entrypoint.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("combined entrypoint", () => {
  it("registers finder and oracle tool modules", () => {
    const source = readFileSync("src/index.ts", "utf-8");
    expect(source).toContain("finderTool");
    expect(source).toContain("oracleTool");
  });
});
EOF
npx vitest run tests/integration/entrypoint.test.ts
```

Expected: FAIL because `src/index.ts` does not register those tools yet.

- [ ] **Step 3: Create `src/tools/finder.ts` by moving the current `finder.ts` logic into a modular export**

```ts
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { defineTool, createReadTool, createGrepTool, createFindTool, createLsTool, createBashTool } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { runIsolatedSubagent } from "../core/subagent.js";

const finderSchema = Type.Object({
  query: Type.String({ description: "Natural language search request" }),
});

type FinderInput = Static<typeof finderSchema>;

const FINDER_CONFIG_PATH = join(homedir(), ".pi", "agent", "finder.json");
const FINDER_SYSTEM_PROMPT = `...move the existing finder system prompt here...`;

function resolveFinderModel(ctx: ExtensionContext) {
  const configured = loadToolConfig(FINDER_CONFIG_PATH)?.model;
  const parsed = configured ? parseModelReference(configured) : null;
  return parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
}

export const finderTool = defineTool({
  name: "finder",
  label: "Finder",
  description: "Launch a specialized search subagent to find files, code patterns, and relationships in the codebase.",
  parameters: finderSchema,
  async execute(_toolCallId, params: FinderInput, signal, _onUpdate, ctx) {
    if (!params.query.trim()) {
      return { content: [{ type: "text", text: "Error: Please provide a non-empty search query." }], details: { error: "empty_query" }, isError: true };
    }
    const model = resolveFinderModel(ctx);
    if (!model) {
      return { content: [{ type: "text", text: "Error: No model available for finder subagent." }], details: { error: "no_model" }, isError: true };
    }
    const text = await runIsolatedSubagent({
      ctx,
      model,
      systemPrompt: FINDER_SYSTEM_PROMPT,
      tools: [createReadTool(ctx.cwd), createGrepTool(ctx.cwd), createFindTool(ctx.cwd), createLsTool(ctx.cwd), createBashTool(ctx.cwd)],
      task: params.query,
      signal,
      timeoutMs: 180_000,
    });
    return { content: [{ type: "text", text }], details: { query: params.query } };
  },
});
```

- [ ] **Step 4: Create `src/tools/oracle.ts` by moving the current `oracle.ts` logic into a modular export**

```ts
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { defineTool, createReadTool, createGrepTool, createFindTool, createLsTool, createBashTool } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { runIsolatedSubagent } from "../core/subagent.js";

const oracleSchema = Type.Object({
  query: Type.String({ description: "Reasoning/debugging request" }),
});

type OracleInput = Static<typeof oracleSchema>;

const ORACLE_CONFIG_PATH = join(homedir(), ".pi", "agent", "oracle.json");
const ORACLE_SYSTEM_PROMPT = `...move the existing oracle system prompt here...`;

function resolveOracleModel(ctx: ExtensionContext) {
  const configured = loadToolConfig(ORACLE_CONFIG_PATH)?.model;
  const parsed = configured ? parseModelReference(configured) : null;
  return parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
}

export const oracleTool = defineTool({
  name: "oracle",
  label: "Oracle",
  description: "Launch a deep-reasoning subagent for debugging tricky problems and nuanced planning.",
  parameters: oracleSchema,
  async execute(_toolCallId, params: OracleInput, signal, _onUpdate, ctx) {
    if (!params.query.trim()) {
      return { content: [{ type: "text", text: "Error: Please provide a non-empty search query." }], details: { error: "empty_query" }, isError: true };
    }
    const model = resolveOracleModel(ctx);
    if (!model) {
      return { content: [{ type: "text", text: "Error: No model available for oracle subagent." }], details: { error: "no_model" }, isError: true };
    }
    const text = await runIsolatedSubagent({
      ctx,
      model,
      systemPrompt: ORACLE_SYSTEM_PROMPT,
      tools: [createReadTool(ctx.cwd), createGrepTool(ctx.cwd), createFindTool(ctx.cwd), createLsTool(ctx.cwd), createBashTool(ctx.cwd)],
      task: params.query,
      signal,
      timeoutMs: 300_000,
    });
    return { content: [{ type: "text", text }], details: { query: params.query } };
  },
});
```

- [ ] **Step 5: Register `finderTool` and `oracleTool` in `src/index.ts`**

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { finderTool } from "./tools/finder.js";
import { oracleTool } from "./tools/oracle.js";

export default function subagentsExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
  pi.registerTool(oracleTool);
}
```

- [ ] **Step 6: Run the entrypoint integration test to verify GREEN**

Run:

```bash
npx vitest run tests/integration/entrypoint.test.ts
```

Expected: PASS.

- [ ] **Step 7: Remove the old root `finder.ts` and `oracle.ts` after migration**

Run:

```bash
rm finder.ts oracle.ts
```

- [ ] **Step 8: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit the migration**

```bash
git add src/tools src/index.ts index.ts tests/integration finder.ts oracle.ts
git commit -m "refactor: migrate finder and oracle into package structure"
```

## Task 4: Implement `worker` with bounded finder fallback

**Files:**
- Create: `src/tools/worker.ts`
- Create: `tests/integration/worker.test.ts`
- Modify: `src/index.ts`
- Modify: `src/core/prompts.ts`

- [ ] **Step 1: Write the failing worker integration test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("worker tool", () => {
  it("is registered by the combined entrypoint", () => {
    const source = readFileSync("src/index.ts", "utf-8");
    expect(source).toContain("workerTool");
  });
});
```

- [ ] **Step 2: Run the worker integration test to verify RED**

Run:

```bash
cat > tests/integration/worker.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("worker tool", () => {
  it("is registered by the combined entrypoint", () => {
    const source = readFileSync("src/index.ts", "utf-8");
    expect(source).toContain("workerTool");
  });
});
EOF
npx vitest run tests/integration/worker.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add the worker prompt to `src/core/prompts.ts`**

```ts
export const WORKER_SYSTEM_PROMPT = `You are Worker, a focused implementation subagent.
Make the smallest viable code change, verify it, and report evidence.
You may use finder once if blocked by codebase uncertainty.
Do not call oracle.
Do not recursively delegate.

## Output Format
## Status
## Summary
## Files Changed
## Verification
## Fallback Used
## Next Step`;
```

- [ ] **Step 4: Implement `src/tools/worker.ts`**

```ts
import { defineTool, createReadTool, createEditTool, createWriteTool, createBashTool } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { runIsolatedSubagent } from "../core/subagent.js";
import { WORKER_SYSTEM_PROMPT } from "../core/prompts.js";
import { finderTool } from "./finder.js";

const workerSchema = Type.Object({
  task: Type.String({ description: "Implementation task to execute" }),
});

type WorkerInput = Static<typeof workerSchema>;
const WORKER_CONFIG_PATH = join(homedir(), ".pi", "agent", "worker.json");

export const workerTool = defineTool({
  name: "worker",
  label: "Worker",
  description: "Launch a focused implementation subagent that makes small code changes and verifies them.",
  parameters: workerSchema,
  async execute(_toolCallId, params: WorkerInput, signal, _onUpdate, ctx) {
    if (!params.task.trim()) {
      return { content: [{ type: "text", text: "Error: Please provide a non-empty task." }], details: { error: "empty_task" }, isError: true };
    }
    const configured = loadToolConfig(WORKER_CONFIG_PATH)?.model;
    const parsed = configured ? parseModelReference(configured) : null;
    const model = parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
    if (!model) {
      return { content: [{ type: "text", text: "Error: No model available for worker subagent." }], details: { error: "no_model" }, isError: true };
    }

    let finderUses = 0;
    const limitedFinderTool = defineTool({
      ...finderTool,
      async execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx) {
        if (finderUses >= 1) {
          return { content: [{ type: "text", text: "Error: finder fallback already used for this worker task." }], details: { error: "finder_fallback_exhausted" }, isError: true };
        }
        finderUses += 1;
        return finderTool.execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx);
      },
    });

    const text = await runIsolatedSubagent({
      ctx,
      model,
      systemPrompt: WORKER_SYSTEM_PROMPT,
      tools: [createReadTool(ctx.cwd), createEditTool(ctx.cwd), createWriteTool(ctx.cwd), createBashTool(ctx.cwd), limitedFinderTool],
      task: params.task,
      signal,
      timeoutMs: 240_000,
    });

    return { content: [{ type: "text", text }], details: { task: params.task, finderFallbackUsed: finderUses > 0 } };
  },
});
```

- [ ] **Step 5: Register `workerTool` in `src/index.ts`**

```ts
import { workerTool } from "./tools/worker.js";

export default function subagentsExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
  pi.registerTool(oracleTool);
  pi.registerTool(workerTool);
}
```

- [ ] **Step 6: Run the worker integration test to verify GREEN**

Run:

```bash
npx vitest run tests/integration/worker.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit worker**

```bash
git add src/core/prompts.ts src/tools/worker.ts src/index.ts tests/integration/worker.test.ts
git commit -m "feat: add worker tool"
```

## Task 5: Implement `manager` with routing logic and single delegation

**Files:**
- Create: `src/tools/manager.ts`
- Create: `tests/integration/manager.test.ts`
- Modify: `src/core/prompts.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing manager integration test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("manager tool", () => {
  it("is registered by the combined entrypoint", () => {
    const source = readFileSync("src/index.ts", "utf-8");
    expect(source).toContain("managerTool");
  });
});
```

- [ ] **Step 2: Run the manager integration test to verify RED**

Run:

```bash
cat > tests/integration/manager.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("manager tool", () => {
  it("is registered by the combined entrypoint", () => {
    const source = readFileSync("src/index.ts", "utf-8");
    expect(source).toContain("managerTool");
  });
});
EOF
npx vitest run tests/integration/manager.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add the manager prompt to `src/core/prompts.ts`**

```ts
export const MANAGER_SYSTEM_PROMPT = `You are Manager, a lightweight routing subagent.
Classify the task and choose the single best next delegate.
You are read-only.

## Routing Policy
- search -> finder
- reasoning -> oracle
- implementation -> worker
- ambiguous -> ask one clarifying question or recommend the next agent

## Output Format
## Task Shape
## Decision
## Why
## Action Taken
## Next Step`;
```

- [ ] **Step 4: Implement `src/tools/manager.ts`**

```ts
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadToolConfig, parseModelReference } from "../core/models.js";
import { runIsolatedSubagent } from "../core/subagent.js";
import { MANAGER_SYSTEM_PROMPT } from "../core/prompts.js";
import { finderTool } from "./finder.js";
import { oracleTool } from "./oracle.js";
import { workerTool } from "./worker.js";

const managerSchema = Type.Object({
  query: Type.String({ description: "Task to classify and route" }),
});

type ManagerInput = Static<typeof managerSchema>;
const MANAGER_CONFIG_PATH = join(homedir(), ".pi", "agent", "manager.json");

export const managerTool = defineTool({
  name: "manager",
  label: "Manager",
  description: "Launch a lightweight routing subagent that chooses the best next specialized tool.",
  parameters: managerSchema,
  async execute(_toolCallId, params: ManagerInput, signal, _onUpdate, ctx) {
    if (!params.query.trim()) {
      return { content: [{ type: "text", text: "Error: Please provide a non-empty query." }], details: { error: "empty_query" }, isError: true };
    }
    const configured = loadToolConfig(MANAGER_CONFIG_PATH)?.model;
    const parsed = configured ? parseModelReference(configured) : null;
    const model = parsed ? ctx.modelRegistry.find(parsed.provider, parsed.modelId) ?? ctx.model : ctx.model;
    if (!model) {
      return { content: [{ type: "text", text: "Error: No model available for manager subagent." }], details: { error: "no_model" }, isError: true };
    }

    let delegated = false;
    const oneShot = (tool: typeof finderTool) => defineTool({
      ...tool,
      async execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx) {
        if (delegated) {
          return { content: [{ type: "text", text: "Error: manager already delegated once for this task." }], details: { error: "delegation_budget_exhausted" }, isError: true };
        }
        delegated = true;
        return tool.execute(toolCallId, toolParams, toolSignal, toolOnUpdate, toolCtx);
      },
    });

    const text = await runIsolatedSubagent({
      ctx,
      model,
      systemPrompt: MANAGER_SYSTEM_PROMPT,
      tools: [oneShot(finderTool), oneShot(oracleTool), oneShot(workerTool)],
      task: params.query,
      signal,
      timeoutMs: 120_000,
    });

    return { content: [{ type: "text", text }], details: { query: params.query, delegated } };
  },
});
```

- [ ] **Step 5: Register `managerTool` in `src/index.ts`**

```ts
import { managerTool } from "./tools/manager.js";

export default function subagentsExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
  pi.registerTool(oracleTool);
  pi.registerTool(workerTool);
  pi.registerTool(managerTool);
}
```

- [ ] **Step 6: Run the manager integration test to verify GREEN**

Run:

```bash
npx vitest run tests/integration/manager.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run all unit + integration tests**

Run:

```bash
npx vitest run tests/unit tests/integration
```

Expected: PASS.

- [ ] **Step 8: Commit manager**

```bash
git add src/core/prompts.ts src/tools/manager.ts src/index.ts tests/integration/manager.test.ts
git commit -m "feat: add manager tool"
```

## Task 6: Add CLI smoke tests and update README

**Files:**
- Create: `tests/e2e/cli-smoke.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing CLI smoke test**

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

describe("cli smoke prerequisites", () => {
  it("has a built extension entrypoint after build", () => {
    expect(existsSync("dist/index.js") || existsSync("dist/src/index.js")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the E2E test to verify RED**

Run:

```bash
mkdir -p tests/e2e && cat > tests/e2e/cli-smoke.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

describe("cli smoke prerequisites", () => {
  it("has a built extension entrypoint after build", () => {
    expect(existsSync("dist/index.js") || existsSync("dist/src/index.js")).toBe(true);
  });
});
EOF
npx vitest run tests/e2e/cli-smoke.test.ts
```

Expected: FAIL before build output exists.

- [ ] **Step 3: Build the package**

Run:

```bash
npm run build
```

Expected: PASS and create `dist/` output.

- [ ] **Step 4: Re-run the E2E smoke test to verify GREEN**

Run:

```bash
npx vitest run tests/e2e/cli-smoke.test.ts
```

Expected: PASS.

- [ ] **Step 5: Manually smoke-test source entrypoint**

Run:

```bash
pi -e ./index.ts -p "List the available tools in this extension bundle"
```

Expected: extension loads without runtime error.

- [ ] **Step 6: Manually smoke-test built entrypoint**

Run:

```bash
pi -e ./dist/index.js -p "List the available tools in this extension bundle"
```

Expected: extension loads without runtime error.

- [ ] **Step 7: Update `README.md` for package install and the four-tool stack**

Add these sections:

```md
## Install

```bash
pi install /absolute/path/to/subagents
```

## Tools

- `finder` — codebase search specialist
- `oracle` — reasoning and debugging specialist
- `worker` — focused implementation specialist
- `manager` — lightweight read-only router

## Development

```bash
pi -e ./index.ts
npm run build
pi -e ./dist/index.js
npm test
```
```

- [ ] **Step 8: Run all tests and typecheck**

Run:

```bash
npm run typecheck && npm test
```

Expected: PASS.

- [ ] **Step 9: Commit docs and smoke coverage**

```bash
git add README.md tests/e2e/cli-smoke.test.ts dist
git commit -m "docs: add package usage and smoke coverage"
```

## Final verification

- [ ] **Step 1: Run final validation suite**

Run:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Expected: all commands PASS.

- [ ] **Step 2: Run final Pi source and build smoke checks**

Run:

```bash
pi -e ./index.ts -p "List the available tools in this extension bundle"
pi -e ./dist/index.js -p "List the available tools in this extension bundle"
```

Expected: both invocations load successfully.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git diff --stat HEAD~1..HEAD
```

Expected: only planned files changed.

## Spec coverage self-review

- proper TS package: Task 1
- proper Pi package: Task 1 + Task 6
- modular `src/`: Tasks 1-5
- combined entrypoint: Tasks 1, 3, 4, 5
- unit/integration/E2E tests: Tasks 2-6
- manager and worker implementation: Tasks 4-5
- source + build runtime support: Tasks 1 and 6

## Placeholder scan self-review

No TODO/TBD placeholders remain. Where prompt content is migrated from existing files, this plan explicitly directs moving the current prompt text into the new modular location rather than inventing a second prompt variant.

## Type consistency self-review

The plan consistently uses:
- `finderTool`
- `oracleTool`
- `workerTool`
- `managerTool`
- `runIsolatedSubagent`
- `classifyTaskShape`
- `chooseDelegate`
- root `index.ts` as dev shim
- `src/index.ts` as combined extension entrypoint
