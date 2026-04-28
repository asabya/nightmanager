# The Nightmanager for Pi

**Four specialized Pi tools for intelligent delegation.**

> **Public site**: [asabya.github.io/nightmanager](https://asabya.github.io/nightmanager) — or see [landing/index.html](landing/index.html) for the source.

| Tool | Role | Best For |
|------|------|----------|
| `finder` | Codebase search | Locating features, tracing module connections |
| `oracle` | Reasoning & debugging | Root-cause analysis, trade-off planning |
| `worker` | Implementation | Smallest viable fix, verified changes |
| `manager` | Orchestration | Coordinating finder/oracle/worker workflows |

> **Quick intro**: See [docs/index.md](docs/index.md) for the full docs.
>
> **Nightmanager workflow**: See [docs/nightmanager.md](docs/nightmanager.md) for autonomous TODO implementation with `manager`.

---

## Install

Local package install:

```bash
pi install /absolute/path/to/nightmanager
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

Configuration is shared across nightmanager in `~/.pi/agent/nightmanager.json`; see [Configuration](#configuration).

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

Configuration is shared across nightmanager in `~/.pi/agent/nightmanager.json`; see [Configuration](#configuration).

Example prompt:

```text
Use oracle to debug why auth middleware fails intermittently
```

### `worker`

Use `worker` for implementation work that needs:
- focused edits
- smallest viable diff
- concrete verification

When invoked with handoff context, `worker` persists a JSON handoff artifact to `.pi/handoffs/` for auditability before execution. The artifact includes objective, findings, target files, decisions, constraints, risks, verification guidance, and evidence.

`worker` accepts optional handoff context from `manager`, `finder`, or `oracle`:
- target files and related files
- findings and decisions
- constraints, risks, and suggested verification

When handoff context is provided, `worker` uses it as the starting map and avoids repeating broad discovery unless the context is missing or contradictory.
It may still use `finder` once if blocked by codebase uncertainty. It does not call `oracle` and does not recursively delegate.

Configuration is shared across nightmanager in `~/.pi/agent/nightmanager.json`; see [Configuration](#configuration).

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

> **Handoff artifacts**: When Worker receives handoff context, a JSON artifact is written to `.pi/handoffs/` for auditability. See [`docs/nightmanager.md`](docs/nightmanager.md#inspecting-handoffs) for how to inspect them.

Configuration is shared across nightmanager in `~/.pi/agent/nightmanager.json`; see [Configuration](#configuration).

Example prompt:

```text
Use manager to investigate the failing auth flow, choose the safest fix, implement it, and verify the result
```

## Configuration

The Nightmanager use one optional config file:

```text
~/.pi/agent/nightmanager.json
```

If the file is missing, malformed, or a configured model cannot be found, the subagent falls back to the current Pi session model. `thinking` defaults to `medium`; avoid `low` for nightmanager.

```json
{
  "agents": {
    "manager": {
      "model": "provider/cheap-or-small-model",
      "thinking": "medium"
    },
    "finder": {
      "model": "provider/cheap-or-small-model",
      "thinking": "medium"
    },
    "worker": {
      "model": "provider/strong-model",
      "thinking": "medium"
    },
    "oracle": {
      "model": "provider/best-reasoning-model",
      "thinking": "high"
    }
  }
}
```

Recommended split:
- `manager` and `finder`: cheaper/smaller models.
- `worker`: stronger code-editing model.
- `oracle`: strongest reasoning model.

For an agent-friendly setup procedure, see [docs/subagent-config-setup.md](docs/subagent-config-setup.md).

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
nightmanager/
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
