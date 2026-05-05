# The Nightmanager for Pi

**Stop babysitting agents. Give them shared understanding.**

Nightmanager is a spec-driven Pi workflow for solo developers and small teams: clarify intent, write local specs/TODOs, then delegate one ready slice for AFK implementation. You come back to validated commits and, when possible, a ready-for-review PR. Nightmanager never merges automatically.

Borrowed/remixed with appreciation from https://github.com/mattpocock/skills.

> Public site: [asabya.github.io/nightmanager](https://asabya.github.io/nightmanager) — source: [docs/index.html](docs/index.html).

## Loop

```text
grill-me → to-prd → to-issues → to-ready → /nightmanager → PR review
```

1. `grill-me`: interrogate unclear intent one question at a time.
2. `to-prd`: create a local draft spec in `specs/draft-*.md`.
3. `to-issues`: slice the spec into vertical draft `TODOs.md` entries.
4. `to-ready`: promote reviewed specs/TODOs and create one promotion commit.
5. `/nightmanager`: select the active ready/bug batch, implement through subagents, validate, commit, push, and open one PR when possible.

Runtime context is intentionally lean: the runner preloads only shared Nightmanager prompts, `TODOs.md`, and the active spec/template. Agents read `README.md`, manifests, or unrelated docs only when needed.

## Tools

| Tool | Role | Use for |
| --- | --- | --- |
| `finder` | Codebase search | Files, usages, relationships |
| `oracle` | Reasoning/debugging | Root cause, trade-offs, next probes |
| `librarian` | OSS research | Upstream code evidence and GitHub permalinks |
| `worker` | Implementation | Small verified edits |
| `manager` | Orchestration | Coordinating finder/oracle/worker phases |

## Install and run

```bash
pi install npm:nightmanager
```

Local development install from another project:

```bash
pi install -l ./path/to/nightmanager
```

Run the autonomous loop in Pi:

```text
/nightmanager
```

Run this repo from source:

```bash
pi -e ./src/index.ts
```

## Planning skills

- `grill-me`: ask one question at a time until goals, risks, and trade-offs are clear.
- `to-prd`: write `specs/draft-<slug>.md` from the current idea/conversation.
- `to-issues`: add draft local `TODOs.md` slices; no GitHub issues unless requested.
- `to-ready`: promote reviewed draft specs/TODOs and commit only the promotion.

## Tool details

### `finder`

Read-only codebase exploration. Use it to find where features live, which files participate in a flow, or how modules connect.

Example:

```text
Use finder to find where authentication is handled
```

### `oracle`

Read-only reasoning for ambiguous failures, root-cause analysis, trade-offs, and the best next probe.

Example:

```text
Use oracle to debug why auth middleware fails intermittently
```

### `librarian`

Read-only external library research. It resolves/clones upstream repos into `/tmp`, inspects source/tests/examples before docs, and cites strict commit-pinned GitHub permalinks.

Example:

```text
Use librarian to compare how Fastify and Express handle request decorators, with source links
```

### `worker`

Focused implementation with the smallest viable diff and concrete verification. With handoff context, Worker writes an audit artifact to `.pi/handoffs/` and avoids rediscovery unless context is missing or contradictory. It may use `finder` once; it cannot use `oracle` or delegate recursively.

Example:

```text
Use worker to make the smallest possible fix and verify it
```

### `manager`

Orchestrates multi-phase tasks: search → reasoning → implementation. Manager does not inspect or edit directly; implementation is gated through internal `handoff_to_worker`, requiring objective, findings, target files, and decisions.

Example:

```text
Use manager to investigate the failing auth flow, choose the safest fix, implement it, and verify the result
```

## Configuration

Optional per-agent config lives at:

```text
~/.pi/agent/nightmanager.json
```

If missing, malformed, or invalid, subagents fall back to the current Pi model. `thinking` defaults to `medium`; avoid `low`.

```json
{
  "agents": {
    "manager": { "model": "provider/cheap-or-small-model", "thinking": "medium" },
    "finder": { "model": "provider/cheap-or-small-model", "thinking": "medium" },
    "worker": { "model": "provider/strong-code-model", "thinking": "medium" },
    "oracle": { "model": "provider/best-reasoning-model", "thinking": "high" },
    "librarian": { "model": "provider/strong-research-model", "thinking": "high" }
  }
}
```

Keep `manager`/`finder` cheaper when possible; reserve stronger models for `worker`, `oracle`, and `librarian`.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build      # alias for typecheck; no dist output
```

Focused tests:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

Package shape:

```text
nightmanager/
  package.json
  src/{core,tools,types}/
  prompts/
  skills/
  specs/
  tests/{unit,integration,e2e}/
```

## Notes

- One Pi extension entrypoint registers all tools and commands.
- Handoff artifacts are written to `.pi/handoffs/` when Worker receives structured context.
- Tests are layered: unit, integration, and selective CLI smoke tests.
