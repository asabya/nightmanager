# Project Agent Router

This repository uses a Nightmanager workflow for autonomous, reviewable implementation with Pi nightmanager.

## Start Here

When asked to do autonomous work, read these files in order:

1. `prompts/agent-loop.md` — operating procedure for Day Shift planning and Nightmanager execution.
2. `TODOs.md` — the implementation queue. Only items marked `[ready]` or `[bug]` are eligible for autonomous implementation.
3. The runner-selected active spec only, or `specs/TEMPLATE.md` for a `[bug]` TODO without a linked spec. Do not load unrelated specs.
4. `prompts/review-personas.md` — review lenses to apply before and after implementation.
5. `README.md` and repo manifests — repository overview, commands, and conventions.

## Subagent Routing

Use the installed subagent tools this way:

- `finder`: codebase discovery, feature tracing, usage search.
- `oracle`: root-cause analysis, ambiguous failures, trade-off decisions.
- `worker`: focused edits when target files and verification are already clear.
- `manager`: broad TODO/spec implementation that may need discovery, reasoning, implementation, and verification.

For Nightmanager execution, the outer Pi session should delegate the selected TODO to `manager`. Do not bypass `manager` for implementation unless the human explicitly asks.

## Testing Plan Source of Truth

Use the selected active batch's linked spec `## Testing Plan` as the single source of truth for validation. Do not duplicate or infer repository validation commands here.

For `[bug]` TODOs without a linked spec, use `specs/TEMPLATE.md ## Testing Plan` as the repository default. If the selected Testing Plan says no automated validation commands are configured, run no test/typecheck/build commands and report that limitation.

Run the narrowest relevant checks from the selected Testing Plan first, then the full listed validation set before committing.

## Commit Discipline

- Keep each completed TODO in its own commit.
- Commit messages must explain intent, important design choices, tests run, and any follow-up notes.
- Do not mix unrelated TODOs in one commit.
- If a TODO is ambiguous or unsafe, update `TODOs.md` with `[blocked]` and a concise reason instead of guessing.
