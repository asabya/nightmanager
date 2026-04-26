# Night Shift Agent Loop

This file defines the workflow for using Pi subagents to implement planned work autonomously.

## Intent

Day Shift is for human thinking: requirements, architecture, specs, and review. Night Shift is for autonomous execution: one ready TODO at a time, delegated to `manager`, with tests, docs, commits, and a concise report.

The goal is not to make agents guess better. The goal is to make the project easier for agents to execute correctly by improving specs, docs, validations, and review loops.

## Day Shift — Human Planning

1. Discuss the feature or bug deeply with humans/stakeholders.
2. Write or update a spec in `Specs/`.
   - Use `Specs/TEMPLATE.md` for new work.
   - Prefix unfinished specs with `draft-`; Night Shift must ignore them.
3. Add a corresponding item to `TODOs.md`.
   - Mark it `[ready]` only when the spec is complete enough for autonomous work.
   - Mark urgent defects `[bug]`.
   - Mark unclear work `[draft]` or `[blocked]`.
4. Strengthen docs and validations before the agent runs.
5. End the day without babysitting implementation.

### Day Shift Planner (Optional)

Optionally, use the Day Shift planner workflow to help brainstorm and organize rough ideas:

- Use `.pi/prompts/day-planner.md` as a reusable prompt template.
- The planner asks clarifying questions when requirements are underspecified.
- It produces draft specs as `Specs/draft-*.md` (ignored by Night Shift).
- Planner-created TODOs are `[draft]` by default.
- **Output is advisory**: the human must review and approve before changing `[draft]` to `[ready]`.
- See the readiness checklist in `.pi/prompts/day-planner.md` for what to confirm.

Example prompts:

> Help me brainstorm a spec for file-based handoffs.

> Turn this rough idea into a draft Night Shift spec and TODO candidate, but do not mark it ready.

The planner is not autonomous execution — it helps the human think, but does not implement code.

## Night Shift — Autonomous Execution

A Night Shift run should perform at most one TODO unless explicitly instructed otherwise.

### 0. Prep

- Inspect `git status`.
- If the tree contains unrelated uncommitted work, do not overwrite it.
- If the tree is unsafe to proceed, update/report the issue and stop.
- Run relevant baseline validation when practical. If baseline is already failing, diagnose whether the failure is related before changing feature code.

### 1. Select Work

Read `TODOs.md` and choose exactly one eligible item:

1. `[bug]` first.
2. Then `[ready]` items by priority and smallest safe scope.
3. Ignore `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`.
4. Ignore specs whose filename begins with `draft-`.

If nothing is eligible, write a concise report and stop.

### 2. Delegate to Manager

The outer Pi session should call `manager` with a self-contained task containing:

- selected TODO title and status,
- linked spec path,
- acceptance criteria,
- constraints,
- validation commands,
- requirement to commit one completed TODO only.

`manager` should orchestrate `finder`, `oracle`, and `worker` as needed. Implementation must flow through `worker` via manager handoff.

### 3. Required Implementation Loop

The manager/subagents should:

1. Load the spec and relevant docs.
2. Use `finder` for unfamiliar code paths.
3. Use `oracle` for ambiguous designs, failures, or trade-offs.
4. Create or update tests before or alongside implementation.
5. Implement the smallest correct change.
6. Run narrow validation, then full validation:

```bash
npm run typecheck
npm test
npm run build
```

7. Update docs when behavior or workflow changes.
8. Re-check the diff against `REVIEW_PERSONAS.md`.
9. Update `TODOs.md` status:
   - `[done]` with commit hash when complete, or
   - `[blocked]` with reason when not safely implementable.
10. Commit the completed TODO as one coherent commit.

### 4. Review Expectations

Before committing, apply these review lenses from `REVIEW_PERSONAS.md`:

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
- files changed,
- validations run and results,
- risks/follow-ups.

Details belong in the commit message and code/docs, not a long chat transcript.

## Day Shift Review

The human reviews:

1. Night Shift report.
2. Changelog/TODO updates.
3. Each commit message.
4. Diff, tests, docs, and manual behavior.

If the agent made a bad decision, first improve the spec, docs, validations, or workflow that allowed it. Then fix the code.
