# Nightmanager Agent Loop

This file defines the workflow for using Pi nightmanager to implement planned work autonomously.

## Intent

Day Shift is for human thinking: requirements, architecture, specs, and review. Nightmanager is for autonomous execution: one runner-selected active batch at a time, delegated to `manager` one TODO at a time, with tests, docs, one branch per spec batch, one commit per TODO, one PR per completed spec batch when possible, and a concise report.

The goal is not to make agents guess better. The goal is to make the project easier for agents to execute correctly by improving specs, docs, validations, and review loops.

## Day Shift — Human Planning

1. Discuss the feature or bug deeply with humans/stakeholders.
2. Write or update a spec in `specs/`.
   - Use `specs/TEMPLATE.md` for new work.
   - Prefix unfinished specs with `draft-`; Nightmanager must ignore them.
3. Add a corresponding item to `TODOs.md`.
   - Mark it `[ready]` only when the TODO links a non-draft spec that is complete enough for autonomous work.
   - Mark urgent defects `[bug]`; bugs may omit a linked spec, in which case Nightmanager uses `specs/TEMPLATE.md ## Testing Plan` as the validation source.
   - Mark unclear work `[draft]` or `[blocked]`.
4. Strengthen docs and validations before the agent runs.
5. End the day without babysitting implementation.

### Day Shift Planner (Optional)

Optionally, use planning skills such as `to-prd`, `to-issues`, or `grill-me` to help brainstorm and organize rough ideas.

- Ask clarifying questions when requirements are underspecified.
- Produce draft specs as `specs/draft-*.md` (ignored by Nightmanager).
- Planner-created TODOs are `[draft]` by default.
- **Output is advisory**: the human must review and approve before changing `[draft]` to `[ready]`.

The planner is not autonomous execution — it helps the human think, but does not implement code.

## Nightmanager — Autonomous Execution

A Nightmanager run works from the runner-selected active batch. Spec-backed batches keep all TODOs with the exact same `Spec:` path on one branch until that spec has no remaining non-done TODOs; `[bug]` TODOs without a spec remain one-TODO batches.

### 0. Prep

- Inspect `git status --porcelain`.
- Nightmanager requires a clean working tree at start; if any pre-existing uncommitted changes are present, stop without modifying anything and report that a clean tree is required.
- Do not stash, reset, or overwrite user changes.
- Run relevant baseline validation when practical. If baseline is already failing, diagnose whether the failure is related before changing feature code.

### 1. Select Work

Use the active TODO/batch selected by the runner from `TODOs.md`:

1. `[bug]` first.
2. Then `[ready]` items by priority and smallest safe scope.
3. Ignore `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`.
4. Ignore specs whose filename begins with `draft-`.

If nothing is eligible, write a concise report and stop.

### 1.5. Create TODO Branch

Before implementation, use the branch name selected once by the Nightmanager runner from the active batch:

- spec-backed work uses the linked spec basename,
- `[bug]` TODOs without a spec use the TODO title,
- do not add a `nightmanager/` prefix,
- the runner checks local and `origin` branch collisions and appends `-2`, then `-3`, etc. until free,
- if slug derivation is empty, stop and report,
- create and switch to the branch from the current branch as-is,
- reuse the same branch for every TODO in the active spec batch.

### 2. Delegate to Manager

The outer Pi session should call `manager` with a self-contained task containing:

- selected TODO title and status,
- linked spec path,
- selected branch name,
- acceptance criteria,
- constraints,
- Testing Plan source and explicit validation/manual-check commands from that source, if any,
- requirement to complete this TODO as one commit on the selected batch branch, without push or PR creation until the active spec batch is complete.

`manager` should orchestrate `finder`, `oracle`, and `worker` as needed. Implementation must flow through `worker` via manager handoff.

### 3. Required Implementation Loop

The manager/nightmanager should:

1. Use the shared docs and runner-loaded active spec only. For a `[bug]` TODO without a linked spec, use `specs/TEMPLATE.md`; do not load unrelated specs.
2. Work only on TODOs whose `Spec:` path exactly matches the active spec. For a `[bug]` TODO without a spec, work only on that one TODO.
3. Use `finder` for unfamiliar code paths.
4. Use `oracle` for ambiguous designs, failures, or trade-offs.
5. Create or update tests before or alongside implementation.
6. Implement the smallest correct change.
7. Run narrow checks from the selected Testing Plan, then the full listed validation set. The linked spec's `## Testing Plan` is the single source of truth; for `[bug]` TODOs without a linked spec, use `specs/TEMPLATE.md ## Testing Plan`. Do not infer or auto-detect validation commands during Nightmanager execution. If the selected Testing Plan says no automated validation commands are configured, run no test/typecheck/build commands and report that limitation.
8. Update docs when behavior or workflow changes.
9. Re-check the diff against `prompts/review-personas.md`.
10. If validation fails, stop with implementation changes left uncommitted for human inspection. Do not commit, push, open a PR, stash, or reset.
11. Update `TODOs.md` status for each completed TODO:
   - `[done]` when complete, recording that TODO's commit hash once available and the PR URL only if batch PR creation succeeds, or
   - `[blocked]` with reason when not safely implementable.
12. Commit each completed TODO as one coherent commit on the batch branch.
13. Continue through the active spec batch until no same-spec TODO remains non-done, or stop when a same-spec TODO must be blocked.
14. After the active spec batch is complete, push the branch to `origin` and open one normal ready-for-review PR with `gh pr create`. Generate the PR title/body from the batch TODOs, linked spec, implementation summary, changed files, validation results, and commit hashes. Do not merge the PR.
15. If push or PR creation fails after commits, keep the local commits and report `completed locally; PR fallback used` with the exact `git`/`gh` reason.
16. After successful PR creation, switch back to the starting branch from the runner; if that fails, report the exact reason without stashing, resetting, or hiding dirty state.

### 4. Review Expectations

Before committing, apply these review lenses from `prompts/review-personas.md`:

- Designer / API ergonomics
- Architect / maintainability
- Domain expert / correctness
- Code expert / tests and edge cases
- Performance expert / cost and scalability
- Human advocate / reviewability and docs

A human should not need to catch obvious type, lint, test, or formatting failures.

### 5. Report

End with a concise report containing:

- TODO selected,
- commit hash or blocked reason,
- PR URL only if created, or `completed locally; PR fallback used` with the exact `git`/`gh` reason when PR creation fails,
- files changed,
- validations run and results,
- risks/follow-ups.

Details belong in the commit message and code/docs, not a long chat transcript.

## Day Shift Review

The human reviews:

1. Nightmanager report.
2. Changelog/TODO updates.
3. Each commit message.
4. Diff, tests, docs, and manual behavior.

If the agent made a bad decision, first improve the spec, docs, validations, or workflow that allowed it. Then fix the code.
