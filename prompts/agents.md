# Project Agent Router

Nightmanager workflow for autonomous, reviewable implementation in Pi.

## Read first

1. `prompts/agent-loop.md`
2. `TODOs.md`
3. Runner-selected active spec only, or `specs/TEMPLATE.md` for a spec-less `[bug]`
4. `prompts/review-personas.md`
5. `README.md`/manifests only as needed

Do not load unrelated specs.

## Route

- `finder`: discover files, usages, relationships.
- `oracle`: diagnose failures, ambiguity, trade-offs.
- `worker`: focused edits when files/verification are clear.
- `manager`: broad TODO/spec work needing discovery + reasoning + implementation.

For Nightmanager execution, delegate the selected TODO to `manager` unless the human explicitly says otherwise.

## Validation

Use only the active spec's `## Testing Plan`; for spec-less `[bug]`, use `specs/TEMPLATE.md ## Testing Plan`. Do not duplicate or infer commands. Run narrow listed checks before the full listed set. If the plan says no automated validation, run none and report it.

## Commits

One coherent commit per completed TODO. Message should cover intent, design choices, tests, and follow-ups. Do not mix unrelated TODOs. If unsafe/ambiguous, mark `[blocked]` in `TODOs.md` with a concise reason.
