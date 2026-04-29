# The Nightmanager for Pi

**Stop babysitting agents. Give them shared understanding.**

Nightmanager is a spec-driven loop for solo developers and small teams: clarify intent, turn it into local specs and vertical TODOs, then delegate one ready slice for AFK implementation. You come back to a validated commit and, when possible, a PR for human review. Nightmanager does not merge automatically.

Some skills here were shamelessly borrowed from, then lovingly remixed from, https://github.com/mattpocock/skills.

> **Public site**: [asabya.github.io/nightmanager](https://asabya.github.io/nightmanager) — or see [docs/index.html](docs/index.html) for the source.

## The Nightmanager Loop

```text
grill-me → to-prd → to-issues → /nightmanager → PR for review
```

1. **Grill the intent** — use `grill-me` to interrogate a feature, bug, or plan one question at a time until hidden requirements, risks, and trade-offs are surfaced.
2. **Generate/refine the spec** — use `to-prd` to turn the clarified conversation into a concrete local spec with goals, non-goals, acceptance criteria, edge cases, testing, and risks.
3. **Slice the work** — use `to-issues` to break the spec into small, vertical local TODOs that are safe for one focused implementation pass. This is local-file-first; it does not create GitHub issues by default.
4. **Delegate AFK implementation** — run `/nightmanager` to select one ready TODO and delegate through Manager, Finder, Oracle, and Worker to implement, validate, commit, and open a PR when possible for human review.

Specs are the shared understanding. Subagents are the execution machinery that preserves your main-session context while doing focused work inside the loop.

| Tool | Role | Best For |
|------|------|----------|
| `finder` | Codebase search | Locating features, tracing module connections |
| `oracle` | Reasoning & debugging | Root-cause analysis, trade-off planning |
| `worker` | Implementation | Smallest viable fix, verified changes |
| `manager` | Orchestration | Coordinating finder/oracle/worker workflows |

---

## Install

Install Nightmanager with Pi:

### Global install

```bash
pi install npm:nightmanager
```

### Local install

From your project:

```bash
pi install -l ./path/to/nightmanager
```

### Run it

Open Pi and run:

```text
/nightmanager
```

If you are developing from the repo instead:

```bash
pi -e ./src/index.ts
```

Source package usage:

```bash
pi -e ./src/index.ts
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

> **Handoff artifacts**: When Worker receives handoff context, a JSON artifact is written to `.pi/handoffs/` for auditability. See [Notes](#notes).

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

## Setup

Use the optional config file at `~/.pi/agent/nightmanager.json` to set models per tool. Missing or malformed config falls back to the current Pi session model.

```json
{
  "agents": {
    "manager": { "model": "provider/cheap-or-small-model", "thinking": "medium" },
    "finder": { "model": "provider/cheap-or-small-model", "thinking": "medium" },
    "worker": { "model": "provider/strong-model", "thinking": "medium" },
    "oracle": { "model": "provider/best-reasoning-model", "thinking": "high" }
  }
}
```

Keep `manager` and `finder` cheaper than `worker` and `oracle` when possible.

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

Build/typecheck (no dist output):

```bash
npm run build
```

Run from source:

```bash
pi -e ./src/index.ts
```

Run the package entrypoint:

```bash
pi -e ./src/index.ts
```

## Package Shape

```text
nightmanager/
  package.json
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
