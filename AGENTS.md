# Project Agent Router

This repository uses a Nightmanager workflow for autonomous, reviewable implementation with Pi nightmanager.

## Start Here

When asked to do autonomous work, read these files in order:

1. `AGENT_LOOP.md` — operating procedure for Day Shift planning and Nightmanager execution.
2. `TODOs.md` — the implementation queue. Only items marked `[ready]` or `[bug]` are eligible for autonomous implementation.
3. `specs/` — detailed feature/bug specs. Ignore files whose basename starts with `draft-`.
4. `REVIEW_PERSONAS.md` — review lenses to apply before and after implementation.
5. `README.md`, `docs/index.md`, and `package.json` — repository overview, commands, and conventions.

## Subagent Routing

Use the installed subagent tools this way:

- `finder`: codebase discovery, feature tracing, usage search.
- `oracle`: root-cause analysis, ambiguous failures, trade-off decisions.
- `worker`: focused edits when target files and verification are already clear.
- `manager`: broad TODO/spec implementation that may need discovery, reasoning, implementation, and verification.

For Nightmanager execution, the outer Pi session should delegate the selected TODO to `manager`. Do not bypass `manager` for implementation unless the human explicitly asks.

## Repository Commands

Prefer these validation commands when relevant:

```bash
npm run typecheck
npm test
npm run build
```

Run the narrowest relevant tests first, then the full validation set before committing.

## Commit Discipline

- Keep each completed TODO in its own commit.
- Commit messages must explain intent, important design choices, tests run, and any follow-up notes.
- Do not mix unrelated TODOs in one commit.
- If a TODO is ambiguous or unsafe, update `TODOs.md` with `[blocked]` and a concise reason instead of guessing.
