# Nightmanager Cycle

Run exactly one Nightmanager cycle for the runner-selected active batch.

## Context

Read these files first when present:

1. `prompts/agents.md`
2. `prompts/agent-loop.md`
3. `TODOs.md`
4. the runner-selected active spec only, or `specs/TEMPLATE.md` for a `[bug]` TODO without a linked spec
5. `prompts/review-personas.md`
6. `README.md` and `package.json` as needed

## Instructions

1. Inspect `git status --porcelain`. Nightmanager requires a clean working tree at start; if any pre-existing uncommitted changes are present, stop without modifying anything and report that a clean tree is required. Do not stash, reset, or overwrite user changes.
2. Use the active TODO/batch selected by the runner from `TODOs.md`:
   - `[bug]` first
   - then `[ready]` by priority and smallest safe scope
   - `[ready]` TODOs must link a non-draft spec
   - `[bug]` TODOs may omit a linked spec; when they do, use `specs/TEMPLATE.md` as the Testing Plan source and treat that TODO as a one-TODO batch
   - ignore specs whose basename starts with `draft-`
3. Use the branch name selected by the Nightmanager runner before implementation. The runner derives it once for the active batch: spec-backed work uses the linked spec basename; `[bug]` TODOs without a spec use the TODO title. It must have no `nightmanager/` prefix and must be free locally and on `origin` after any `-2`, `-3`, etc. suffix. Create and switch to that branch from the current branch as-is.
4. Use the linked active spec already loaded by the runner plus shared docs. For a `[bug]` TODO without a linked spec, use `specs/TEMPLATE.md` for the repository default Testing Plan and rely on the TODO for scope and acceptance. Do not load unrelated specs.
5. For a spec-backed batch, keep working only on TODOs whose `Spec:` path exactly matches the runner-selected active spec. Do not switch to another spec while any TODO for the active spec remains non-done; if a same-spec TODO is unsafe or ambiguous, mark it `[blocked]` with a concise reason and stop the batch.
6. Delegate implementation to the `manager` tool one TODO at a time with a self-contained handoff containing:
   - selected TODO title and status
   - linked spec path and active batch key
   - selected branch name
   - acceptance criteria
   - constraints and risks
   - Testing Plan source: the linked spec's `## Testing Plan`, or `specs/TEMPLATE.md` only for a `[bug]` TODO with no linked spec
   - explicit validation/manual-check commands from that Testing Plan, if any
   - requirement to complete this TODO as one commit on the batch branch, without pushing or opening a PR until the batch is complete
7. Require tests/docs/validation appropriate to each TODO using the selected Testing Plan as the single source of truth. Do not infer or auto-detect validation commands at Nightmanager runtime. If the Testing Plan says no automated validation commands are configured, run no test/typecheck/build commands and report that limitation.
8. If validation fails, stop with implementation changes left uncommitted for human inspection. Do not commit, push, open a PR, stash, or reset.
9. Update `TODOs.md` to `[done]` for each completed TODO, recording that TODO's commit hash once available. Record the PR URL only after batch PR creation succeeds; use `[blocked]` with a concise reason when not safely implementable.
10. Commit each completed TODO separately on the same batch branch. Do not implement TODOs from any other spec in this run.
11. After the active spec batch is complete, try to push the branch to `origin` and open one normal ready-for-review PR with `gh pr create`. Use PR title/body content from the batch TODOs, linked spec, implementation summary, files changed, validation results, and commit hashes. Do not merge the PR.
12. If push or PR creation fails after the batch commits, keep the local commits and report `completed locally; PR fallback used` with the exact `git`/`gh` failure reason.
13. After successful PR creation, switch back to the starting branch reported by the runner. If switching back fails, report the exact reason and do not hide dirty state.
14. End with a concise report: selected batch, branch name, commit hashes or blocked reason, PR URL only if created, local-commit fallback reason when PR creation fails, files changed, validations run, and follow-ups.

Do not ask for live steering. If the TODO/spec is ambiguous or unsafe, block it with an explanation instead of guessing.
