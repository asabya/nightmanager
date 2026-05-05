# Nightmanager Cycle

Run one runner-selected active batch.

## Load

Read, if present: `prompts/agents.md`, `prompts/agent-loop.md`, `TODOs.md`, the active spec only (or `specs/TEMPLATE.md` for a spec-less `[bug]`), `prompts/review-personas.md`, and `README.md`/`package.json` only as needed.

## Rules

1. Start only from a clean `git status --porcelain`; if dirty, stop. Never stash/reset/overwrite user work.
2. Use the runner-selected TODO/batch: `[bug]` before `[ready]`; `[ready]` requires a non-draft spec; spec-less `[bug]` is a one-TODO batch using `specs/TEMPLATE.md`; ignore `draft-*` specs.
3. Use the runner-selected branch name for the whole batch. Create it from the current branch; do not derive another name or add `nightmanager/`.
4. Use only shared docs plus the active spec/TEMPLATE. For spec-backed batches, work only TODOs with the exact active `Spec:` path; if same-spec work is unsafe/ambiguous, mark `[blocked]` and stop.
5. Delegate each TODO to `manager` with: TODO title/status, active spec/batch key, branch, acceptance criteria, constraints/risks, Testing Plan source, explicit validation/manual commands, and “one commit; no push/PR until batch complete.”
6. The selected `## Testing Plan` is the only validation source. Do not infer commands. If it says no automated validation, run none and report that.
7. If validation fails, leave changes uncommitted for review; do not commit/push/PR/stash/reset.
8. For each completed TODO, update `TODOs.md` to `[done]` with commit hash. Add PR URL only after PR creation succeeds. Use `[blocked]` with reason when needed.
9. Commit each completed TODO separately on the batch branch; never mix other specs.
10. When the batch is complete, push and create one ready-for-review PR via `gh pr create` using TODO/spec summary, files, validation, and commits. Do not merge.
11. If push/PR fails after commits, keep local commits and report `completed locally; PR fallback used` plus exact failure.
12. After PR success, switch back to the runner-reported starting branch; if that fails, report the reason without hiding dirty state.
13. Final report: batch, branch, commit hashes or blocked reason, PR URL only if created, fallback reason if any, files changed, validations, follow-ups.

Do not ask for live steering; block ambiguous/unsafe work instead of guessing.
