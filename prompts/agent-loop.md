# Nightmanager Agent Loop

This file defines the workflow for using Pi nightmanager to implement planned work autonomously.

## Intent

Day Shift is for human thinking: requirements, architecture, specs, and review. Nightmanager is for autonomous execution: one ready TODO at a time, delegated to `manager`, with tests, docs, one branch, one commit, one PR when possible, and a concise report.

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

A Nightmanager run should perform at most one TODO unless explicitly instructed otherwise: one TODO = one branch = one commit = one PR when possible.

### 0. Prep

- Inspect `git status --porcelain`.
- Nightmanager requires a clean working tree at start; if any pre-existing uncommitted changes are present, stop without modifying anything and report that a clean tree is required.
- Do not stash, reset, or overwrite user changes.
- Run relevant baseline validation when practical. If baseline is already failing, diagnose whether the failure is related before changing feature code.

### 1. Select Work

Read `TODOs.md` and choose exactly one eligible item:

1. `[bug]` first.
2. Then `[ready]` items by priority and smallest safe scope.
3. Ignore `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`.
4. Ignore specs whose filename begins with `draft-`.

If nothing is eligible, write a concise report and stop.

### 1.5. Create TODO Branch

Before implementation, derive a branch name from the selected TODO title:

- sanitize the title into a valid branch slug; if it is empty, stop and report,
- do not add a `nightmanager/` prefix,
- if the branch exists locally or on `origin`, append `-2`, then `-3`, etc. until free,
- create and switch to the branch from the current branch as-is.

### 2. Delegate to Manager

The outer Pi session should call `manager` with a self-contained task containing:

- selected TODO title and status,
- linked spec path,
- selected branch name,
- acceptance criteria,
- constraints,
- Testing Plan source and explicit validation/manual-check commands from that source, if any,
- requirement to complete exactly one TODO as one branch, one commit, and one PR when possible.

`manager` should orchestrate `finder`, `oracle`, and `worker` as needed. Implementation must flow through `worker` via manager handoff.

### 3. Required Implementation Loop

The manager/nightmanager should:

1. Load the spec and relevant docs.
2. Use `finder` for unfamiliar code paths.
3. Use `oracle` for ambiguous designs, failures, or trade-offs.
4. Create or update tests before or alongside implementation.
5. Implement the smallest correct change.
6. Run narrow checks from the selected Testing Plan, then the full listed validation set. The linked spec's `## Testing Plan` is the single source of truth; for `[bug]` TODOs without a linked spec, use `specs/TEMPLATE.md ## Testing Plan`. Do not infer or auto-detect validation commands during Nightmanager execution. If the selected Testing Plan says no automated validation commands are configured, run no test/typecheck/build commands and report that limitation.
7. Update docs when behavior or workflow changes.
8. Re-check the diff against `prompts/review-personas.md`.
9. If validation fails, stop with implementation changes left uncommitted for human inspection. Do not commit, push, open a PR, stash, or reset.
10. Update `TODOs.md` status:
   - `[done]` when complete, recording the commit hash once available and the PR URL only if PR creation succeeds, or
   - `[blocked]` with reason when not safely implementable.
11. Commit the completed TODO as one coherent commit.
12. After the local commit succeeds, push the branch to `origin` and open a normal ready-for-review PR with `gh pr create`. Generate the PR title/body from the TODO, linked spec, implementation summary, changed files, validation results, and commit hash. Do not merge the PR.
13. If push or PR creation fails after commit, keep the local commit and report `completed locally; PR fallback used` with the exact `git`/`gh` failure reason.

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
