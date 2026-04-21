# Subagents for Pi

A TypeScript + Pi package that bundles four specialized subagent tools:

- `finder` — codebase search specialist
- `oracle` — reasoning and debugging specialist
- `worker` — focused implementation specialist
- `manager` — lightweight read-only router

The package is designed for a strong token-cost to performance ratio: lightweight prompts, isolated subagent context, and clear role boundaries.

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

`worker` may use `finder` once if blocked by codebase uncertainty.
It does not call `oracle` and does not recursively delegate.

Model selection order:
1. `~/.pi/agent/worker.json`
2. current Pi session model

Example prompt:

```text
Use worker to make the smallest possible fix and verify it
```

### `manager`

Use `manager` when you want a lightweight router that picks the best next specialized tool.

Default routing policy:
- search -> `finder`
- reasoning -> `oracle`
- implementation -> `worker`
- ambiguous -> clarifying question or recommendation

`manager` is read-only and delegates to one best-fit tool by default.

Model selection order:
1. `~/.pi/agent/manager.json`
2. current Pi session model

Example prompt:

```text
Use manager to route this implementation task
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
