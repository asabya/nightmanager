# Nightmanager Agent Loop

Nightmanager turns human-approved specs/TODOs into small, reviewable autonomous changes: one runner-selected active batch, one branch per spec batch, one commit per TODO, one PR per completed batch.

## Day Shift (human planning)

- Discuss requirements, then write/update `specs/` using `specs/TEMPLATE.md`.
- Prefix unfinished specs `draft-`; Nightmanager ignores them.
- Add `TODOs.md` items: `[ready]` only for non-draft linked specs; `[bug]` for urgent safe defects (may omit spec and then uses `specs/TEMPLATE.md ## Testing Plan`); `[draft]`/`[blocked]` otherwise.
- Strengthen docs, acceptance criteria, and validation before autonomous runs.
- Optional planning skills: `grill-me`, `wayfinder` (large foggy efforts), `research`, `to-spec`, `to-tickets`. Their output is advisory until human-promoted, e.g. with `to-ready`.
- Optional attended implementation: `/implement` works one ready ticket in the foreground (TDD → `/code-review` → commit), claiming it with `[in-progress]` so this run skips it.

## Nightmanager run

### 0. Prep

- Require clean `git status --porcelain`; stop on pre-existing changes. Never stash/reset/overwrite.
- Baseline validation only when practical and relevant.

### 1. Select work

Use the runner-selected active batch from `TODOs.md`: `[bug]` first, then `[ready]` by priority/safe scope. Ignore `[draft]`, `[blocked]`, `[in-progress]`, `[done]`, and `draft-*` specs. If none, report and stop.

### 1.5 Branch

Use the runner-selected branch name for the batch: spec basename for spec-backed work, TODO title for spec-less `[bug]`, no `nightmanager/`, collision suffixes `-2`, `-3`, etc. Create/switch from the current branch and reuse it for the whole batch.

### 2. Delegate

Call `manager` for each TODO with a self-contained task: TODO title/status, spec path, branch, acceptance, constraints/risks, Testing Plan source plus explicit commands, and “finish this TODO as one commit; do not push/PR until batch complete.” Manager may use `finder`, `oracle`, and `worker`; implementation flows through worker.

### 3. Implement

- Use only shared docs plus the active spec, or `specs/TEMPLATE.md` for spec-less `[bug]`.
- Work only TODOs in the active exact-spec batch; block unsafe/ambiguous same-spec work.
- Use `finder` for unfamiliar code and `oracle` for ambiguity, failures, or trade-offs.
- Make the smallest correct change; update tests/docs as needed.
- Validate only from the selected `## Testing Plan`: narrow checks first, then full listed set. If it says no automated validation, run none and report that.
- Apply `prompts/review-personas.md` before commit.
- On validation failure, leave changes uncommitted; do not commit/push/PR/stash/reset.
- Mark completed TODOs `[done]` with commit hash; add PR URL only after PR creation. Mark unsafe TODOs `[blocked]` with reason.
- Commit each TODO separately; continue same-spec batch until no non-done TODO remains or one is blocked.
- Push and open one ready-for-review PR via `gh pr create`; do not merge. If push/PR fails after commits, keep local commits and report exact fallback reason.
- After PR success, return to the starting branch; report any failure exactly.

### 4. Review lenses

Use `prompts/review-personas.md`: API ergonomics, maintainability, correctness, tests/reliability, cost/scalability, reviewability/docs.

### 5. Report

Return: selected TODO/batch, commit hash or blocked reason, PR URL only if created (or fallback reason), files changed, validations/results, risks/follow-ups. Keep detail in commits/docs, not chat.

## Human review

Review report, TODO/changelog updates, commits, diff, tests, docs, and manual behavior. If the agent erred, improve the spec/docs/validation/workflow before retrying.
