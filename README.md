// TEST-MARKER-123
# Subagents for Pi

**Four specialized Pi subagents for intelligent delegation.**

> **Public site**: [subagents.deno.dev](https://subagents.deno.dev) — or see [landing/index.html](landing/index.html) for the source.

| Tool | Role | Best For |
|------|------|----------|
| `finder` | Codebase search | Locating features, tracing module connections |
| `oracle` | Reasoning & debugging | Root-cause analysis, trade-off planning |
| `worker` | Implementation | Smallest viable fix, verified changes |
| `manager` | Orchestration | Coordinating finder/oracle/worker workflows |

> **Quick intro**: See [docs/index.md](docs/index.md) for the full docs.

---

## Install

Local package install:

```bash
pi install /absolute/path/to/subagents
```

Quick development usage from the repo:

```bash
pi -e ./index.ts
```

Built usage:

```bash
npm run build
pi -e ./dist/index.js
```

## Tools

### `finder`

Use `finder` for codebase exploration tasks like:
- where a feature is implemented
- which files participate in a flow
- how modules connect

Model selection order:
1. `~/.pi/agent/finder.json`
2. current Pi session model

Example config:

```json
{
  "model": "ollama/glm-5:cloud"
}
```

Example prompt:

```text
Use finder to find where authentication is handled
```

### `oracle`

Use `oracle` for reasoning-heavy tasks like:
- debugging ambiguous failures
- root-cause analysis
- trade-off-aware planning
- deciding the best next probe

Model selection order:
1. `~/.pi/agent/oracle.json`
2. current Pi session model

Example prompt:

```text
Use oracle to debug why auth middleware fails intermittently
```

### `worker`

Use `worker` for implementation work that needs:
- focused edits
- smallest viable diff
- concrete verification

`worker` accepts optional handoff context from `manager`, `finder`, or `oracle`:
- target files and related files
- findings and decisions
- constraints, risks, and suggested verification

When handoff context is provided, `worker` uses it as the starting map and avoids repeating broad discovery unless the context is missing or contradictory.
It may still use `finder` once if blocked by codebase uncertainty. It does not call `oracle` and does not recursively delegate.

Model selection order:
1. `~/.pi/agent/worker.json`
2. current Pi session model

Example prompt:

```text
Use worker to make the smallest possible fix and verify it
```

### `manager`

Use `manager` when a task may need multiple specialist phases, such as discovery -> diagnosis -> implementation.

Default orchestration policy:
- simple search -> `finder`
- simple reasoning/debugging -> `oracle`
- clear implementation -> `worker`
- implementation in unfamiliar code -> `finder` -> `worker`
- ambiguous failure plus requested fix -> `oracle` -> `worker`
- broad feature/change -> `finder` -> optional `oracle` -> `worker`
- ambiguous intent -> clarifying question

`manager` does not inspect or edit files directly. It delegates to specialized tools, passes structured handoff context between phases, and synthesizes the final result. Implementation is hard-gated through an internal `handoff_to_worker` tool, which requires non-empty objective, findings, target files, and decisions before Worker can run.

Model selection order:
1. `~/.pi/agent/manager.json`
2. current Pi session model

Example prompt:

```text
Use manager to investigate the failing auth flow, choose the safest fix, implement it, and verify the result
```

## Development

Install dependencies:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Run specific test layers:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Run from source:

```bash
pi -e ./index.ts
```

Run built output:

```bash
pi -e ./dist/index.js
```

## Package Shape

```text
subagents/
  package.json
  index.ts
  src/
    index.ts
    tools/
    core/
    types/
  tests/
    unit/
    integration/
    e2e/
```

## Notes

- The package uses one combined Pi extension entrypoint.
- The internal code is modular for testability and maintenance.
- The test strategy is layered: unit + integration + selective CLI smoke tests.
