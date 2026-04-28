# Spec: Day Shift Planner / Brainstorming Agent

Status: ready
Owner: human
Created: 2026-04-26
Ready for Nightmanager: 2026-04-26

## Problem

Nightmanager works best when TODOs and specs are detailed, scoped, and reviewable before autonomous implementation starts. Today the human can write specs manually, but there is no dedicated Day Shift helper that pressure-tests requirements, identifies edge cases, and converts rough ideas into Nightmanager-ready specs/TODOs.

A planning assistant could improve spec quality without violating the Nightmanager principle: the human remains in control during Day Shift, while agents help brainstorm and organize thinking.

## Goals

- Add or document a Day Shift planning workflow that helps convert rough ideas into well-scoped specs and TODOs.
- Help humans identify missing requirements, edge cases, risks, validation commands, docs impacts, and acceptance criteria.
- Produce file-based planning artifacts under `Specs/` and updates to `TODOs.md`.
- Keep incomplete planning artifacts clearly marked as `draft-*` and not eligible for Nightmanager.
- Encourage human review/approval before a TODO becomes `[ready]`.
- Make the planner useful for brainstorming and critique, not autonomous implementation.

## Non-Goals

- Do not let the planner mark work `[ready]` without explicit human approval.
- Do not let the planner implement code.
- Do not replace human product/design/architecture thinking.
- Do not make Nightmanager depend on chat-only context.
- Do not create a broad product-management system or external database.

## Current Behavior

The repository already has a Nightmanager workflow:

- `AGENT_LOOP.md` defines Day Shift planning and Nightmanager execution.
- `TODOs.md` is the implementation queue.
- `Specs/` contains implementation specs; files prefixed with `draft-` are ignored by Nightmanager.
- `Specs/TEMPLATE.md` provides a spec template.
- `REVIEW_PERSONAS.md` defines review lenses.
- `AGENTS.md` routes autonomous work through `manager`.

The current Day Shift process is mostly manual. The user can ask the main Pi session to help write specs, but there is no explicit planner persona/tool/workflow with rules that preserve human control.

## Desired Behavior

Implement the documentation-first planner workflow. A Day Shift planner workflow should support commands or prompts such as:

```text
Help me brainstorm a spec for file-based handoffs.
```

or:

```text
Turn this rough idea into a draft Nightmanager spec and TODO candidate, but do not mark it ready.
```

The planner should:

1. Ask clarifying questions when the idea is underspecified.
2. Identify likely implementation areas, tests, docs, and risks.
3. Suggest scope cuts to keep the Nightmanager task small.
4. Produce or update a `Specs/draft-*.md` file using `Specs/TEMPLATE.md` structure.
5. Optionally add a `[draft]` TODO entry linked to the draft spec.
6. Include an explicit “Readiness Checklist” showing what the human must confirm before changing the TODO to `[ready]`.
7. Avoid implementation and avoid changing production code.

## Acceptance Criteria

- [x] A documented Day Shift planner workflow exists in repo docs.
- [x] The workflow clearly states that planner output is advisory and human-approved.
- [x] Planner-created specs are written as `Specs/draft-*.md` by default.
- [x] Planner-created TODOs are `[draft]` by default.
- [x] The workflow includes a readiness checklist for promoting a draft to `[ready]`.
- [x] The workflow tells Nightmanager to ignore planner drafts until the human promotes them.
- [x] Documentation distinguishes Day Shift planner work from Nightmanager manager implementation work.
- [x] At least one example prompt or prompt template is added for using the planner.

## Edge Cases

- The planner may over-scope a feature; it should recommend splitting into smaller Nightmanager TODOs.
- The planner may infer requirements incorrectly; specs must include open questions rather than guesses.
- Some work may need discovery before planning; planner may use `finder` for codebase mapping, but should not implement changes.
- Some ideas may be too vague; planner should leave the spec as draft and list blocking questions.
- Existing TODOs/specs should not be overwritten without explicit human instruction.

## Suggested Approach

Implement the documentation-first workflow only.

Required changes:

- Add a Day Shift planner section to `AGENT_LOOP.md` that explains when to use the planner workflow before Nightmanager.
- Add or update `docs/nightmanager.md` with a `Day Shift Planner` section that distinguishes planner responsibilities from Nightmanager `manager` implementation responsibilities.
- Add `.pi/prompts/day-planner.md` as a reusable prompt template. The prompt must instruct the assistant to:
  - ask clarifying questions when requirements are underspecified,
  - use `Specs/TEMPLATE.md` structure,
  - write specs as `Specs/draft-*.md` by default,
  - add TODOs as `[draft]` by default only when requested,
  - include acceptance criteria, edge cases, testing plan, documentation updates, risks, and open questions,
  - include a readiness checklist,
  - avoid implementation and production code edits.
- Update `TODOs.md` status tag guidance to mention planner-created `[draft]` TODOs.
- Update `Specs/README.md` to mention planner-created draft specs and the promotion process.

Do not add a dedicated fifth `planner` subagent in this TODO. That remains future work if the prompt workflow proves useful.

## Testing Plan

Minimum validation for documentation/prompt-only implementation:

```bash
npm run typecheck
npm test
npm run build
```

Manual validation:

1. Use the planner prompt on a rough feature idea.
2. Confirm it creates a `Specs/draft-*.md` file.
3. Confirm any TODO entry is `[draft]`, not `[ready]`.
4. Confirm the draft includes acceptance criteria, edge cases, testing plan, docs updates, and open questions.
5. Confirm Nightmanager would ignore the draft until human promotion.

## Documentation Updates

- `AGENT_LOOP.md`: add Day Shift planner guidance.
- `docs/nightmanager.md`: explain planner-vs-manager responsibilities.
- `.pi/prompts/day-planner.md`: add reusable prompt.
- `Specs/README.md`: mention planner-created drafts and promotion process.

## Readiness Checklist Before Marking Ready

Human must confirm:

- [ ] Problem and desired behavior are clear.
- [ ] Scope is small enough for one Nightmanager TODO.
- [ ] Acceptance criteria are testable.
- [ ] Edge cases and non-goals are documented.
- [ ] Validation commands are listed.
- [ ] Relevant docs/code areas are named or discoverable.
- [ ] Open questions are resolved or explicitly deferred.
- [ ] TODO status is manually changed from `[draft]` to `[ready]`.

## Risks / Open Questions

Resolved for this TODO:

- Use a documentation/prompt workflow, not a fifth subagent.
- Planner may use normal Pi discovery tools such as `finder` for planning context, but must not implement code.
- Human review is required before renaming a spec from `draft-*` or changing a TODO from `[draft]` to `[ready]`.

Deferred follow-ups:

- Consider a dedicated `planner` subagent only after the prompt workflow is used repeatedly.
- Consider optional scope/complexity labels for planner drafts if humans find them useful.
