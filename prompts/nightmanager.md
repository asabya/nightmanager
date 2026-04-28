# Nightmanager Cycle

Run exactly one Nightmanager cycle.

## Context

Read these files first when present:

1. `prompts/agents.md`
2. `prompts/agent-loop.md`
3. `TODOs.md`
4. relevant non-draft specs in `specs/`
5. `prompts/review-personas.md`
6. `README.md` and `package.json` as needed

## Instructions

1. Inspect `git status`. If unrelated uncommitted work makes the tree unsafe, stop and report.
2. Select exactly one eligible TODO from `TODOs.md`:
   - `[bug]` first
   - then `[ready]` by priority and smallest safe scope
   - ignore `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`
   - ignore specs whose basename starts with `draft-`
3. Load the linked spec and relevant docs.
4. Delegate implementation to the `manager` tool with a self-contained handoff containing:
   - selected TODO title and status
   - linked spec path
   - acceptance criteria
   - constraints and risks
   - validation commands
   - requirement to commit one completed TODO only
5. Require tests/docs/validation appropriate to the TODO, including the repository's standard validation commands when relevant:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

6. Update `TODOs.md` to `[done]` with commit hash when complete, or `[blocked]` with a concise reason when not safely implementable.
7. Commit exactly one completed TODO. Do not implement multiple TODOs in this run.
8. End with a concise report: selected TODO, commit or blocked reason, files changed, validations run, and follow-ups.

Do not ask for live steering. If the TODO/spec is ambiguous or unsafe, block it with an explanation instead of guessing.
