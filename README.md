# The Nightmanager for Pi

**Stop babysitting agents. Give them shared understanding.**

Nightmanager is a spec-driven Pi workflow for solo developers and small teams: clarify intent, write local specs/TODOs, then delegate one ready slice for AFK implementation. You come back to validated commits and, when possible, a ready-for-review PR. Nightmanager never merges automatically.

Borrowed/remixed with appreciation from https://github.com/mattpocock/skills.

> Public site: [asabya.github.io/nightmanager](https://asabya.github.io/nightmanager) — source: [docs/index.html](docs/index.html).

## Loop

```text
grill-me / wayfinder → to-spec → to-tickets → to-ready → ( /implement | /nightmanager ) → /code-review → PR review
```

1. `grill-me`: interrogate unclear intent one question at a time. For large, foggy efforts, `wayfinder` charts a local map of investigation tickets first.
2. `to-spec`: synthesise a local draft spec in `specs/draft-*.md`.
3. `to-tickets`: slice the spec into vertical draft `TODOs.md` tickets.
4. `to-ready`: promote reviewed specs/tickets and create one promotion commit.
5. Implement — two ways from the same queue:
   - `/nightmanager` (AFK): select the active ready/bug batch, implement through subagents, validate, commit, push, and open one PR when possible.
   - `/implement` (attended): work one ready ticket in the foreground — TDD where seams allow, then `/code-review`, then commit. Claims its ticket with `[in-progress]` so the night shift skips it.

Both paths apply the two-axis review (`/code-review`); `research` gathers primary-source notes when a ticket needs them.

Runtime context is intentionally lean: the runner preloads only shared Nightmanager prompts, `TODOs.md`, and the active spec/template. Agents read `README.md`, manifests, or unrelated docs only when needed.

## Supported runtimes

Nightmanager runs on two native runtimes from **one shared set of prompts and skills**. The workflow, the five role definitions (finder, oracle, librarian, worker, manager), and the skills are identical across both — each host owns agent execution. Role prompts have a single canonical source in `prompts/agents/*.md`; the Pi TS module and the Claude agent files are generated from it.

### Pi

```bash
pi install npm:nightmanager
```

Pi uses the Nightmanager extension and its programmatic subagent runtime: five subagent tools, a model registry integration, `~/.pi/agent/nightmanager.json` config, custom transcript rendering, and **programmatically validated** Manager→Worker handoffs. Pi remains the stricter implementation.

### Claude Code

```bash
npx nightmanager install claude
```

Claude Code uses **native Claude subagents and skills** — installed into `~/.claude/` by default (`--project` targets `./.claude/`). No separate Anthropic API key is required by Nightmanager: Claude Code owns authentication and model access. On Claude the handoff and orchestration rules are **prompt-enforced**. See [integrations/claude-code/README.md](integrations/claude-code/README.md).

| Capability | Pi | Claude Code |
| --- | --- | --- |
| Agent runtime | Nightmanager/Pi runtime | Claude native |
| Authentication | Pi provider configuration | Claude Code |
| Structured handoff | Programmatically validated | Prompt-enforced |
| Tool restrictions | Pi tool definitions | Claude agent configuration |
| Transcript rendering | Nightmanager custom rendering | Claude native UI |
| Workflow prompts | Shared | Shared |
| Skills | Shared / Pi package | Claude-native installation |

## Tools

| Tool | Role | Use for |
| --- | --- | --- |
| `finder` | Codebase search | Files, usages, relationships |
| `oracle` | Reasoning/debugging | Root cause, trade-offs, next probes |
| `librarian` | OSS research | Upstream code evidence and GitHub permalinks |
| `worker` | Implementation | Small verified edits |
| `manager` | Orchestration | Coordinating finder/oracle/worker phases |

## Running on Pi

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

## Planning and implementation skills

- `grill-me`: ask one question at a time (facts looked up, decisions put to you) until goals, risks, and trade-offs are clear; a confirmation gate keeps it from jumping to a spec or implementation.
- `wayfinder`: for efforts too big for one session — chart a local `specs/map-<slug>.md` of research/grilling/task tickets and resolve them one at a time until the way is clear.
- `research`: dispatch the `librarian` to investigate a question against primary sources and save a note under `docs/research/`.
- `to-spec`: synthesise `specs/draft-<slug>.md` from the current conversation (no interview).
- `to-tickets`: add vertically-sliced draft `TODOs.md` tickets with blocking edges; no GitHub issues unless requested.
- `to-ready`: promote reviewed draft specs/tickets and commit only the promotion.
- `/implement`: attended implementation of one ready ticket (TDD → `/code-review` → commit); the foreground counterpart to `/nightmanager`.
- `/code-review`: two-axis review of a diff — Standards (repo conventions + Fowler code smells) and Spec (matches the ticket) — run as parallel sub-agents. Also applied inline by the night shift.
- `tdd`: reference material for the red → green loop used by `/implement` and the night-shift worker.

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
npm run generate         # regenerate the Pi module + Claude agents from prompts/agents/*.md
npm run check:generated  # fail if the committed generated files are stale
npm run typecheck
npm test
npm run build            # check:generated + typecheck + compile the CLI to dist/
```

Role prompts have a single canonical source in `prompts/agents/*.md`. After editing one, run `npm run generate`; the committed `src/shared/generated-prompts.ts` and `integrations/claude-code/agents/*.md` must stay in sync. `npm run check:generated` (part of `npm run build` and `prepublishOnly`) fails if they drift — run it before publishing, and wire it into CI if you add a pipeline.

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
  bin/                       # nightmanager CLI (compiled to dist/)
  scripts/                   # generate-prompts, install-claude
  src/{core,tools,types}/
  src/shared/                # generated-prompts.ts (generated; committed)
  prompts/agents/            # canonical role prompts (source of truth)
  prompts/                   # Pi workflow prompts
  skills/                    # shared workflow skills
  integrations/claude-code/  # native Claude agents, skills, README
  specs/
  tests/{unit,integration,e2e}/
```

## Notes

- One Pi extension entrypoint registers all tools and commands.
- Handoff artifacts are written to `.pi/handoffs/` when Worker receives structured context.
- Tests are layered: unit, integration, and selective CLI smoke tests.
