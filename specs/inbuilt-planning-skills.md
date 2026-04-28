# Spec: Inbuilt planning skills for nightmanager

Status: ready
Owner: human
Created: 2026-04-27

## Problem

Right now, the planning workflows that help humans move from rough ideas to implementation-ready work are spread across prompts, docs, and external conventions. The repo already has strong Nightmanager execution workflows, but the plan-to-spec and plan-to-todos steps are not packaged as first-class Pi skills that are immediately available after installing `nightmanager`.

We want three lightweight, discoverable skills to ship with the extension so users can access them directly in Pi without extra setup:

- `grill-me` for relentless design interrogation
- `to-prd` for turning a rough idea into a draft spec
- `to-issues` for breaking a spec into vertically sliced TODOs

## Goals

- Make `grill-me`, `to-prd`, and `to-issues` available as inbuilt Pi skills after installing `nightmanager`.
- Keep `grill-me` extremely small and prompt-only.
- Preserve the existing repo conventions for specs and TODOs.
- Ensure `to-prd` creates specs in `specs/`.
- Ensure `to-issues` creates local `TODOs.md` entries by default, with GitHub issue creation only when explicitly requested.
- Ensure `to-issues` splits work into multiple vertically scalable TODOs when the spec warrants it.
- Keep Nightmanager operating on local repo artifacts, not GitHub as the primary source of truth.

## Non-Goals

- Reworking the Nightmanager execution model.
- Changing the core `specs/` template format.
- Changing the core `TODOs.md` format.
- Adding a dedicated planning subagent beyond these skills.
- Making GitHub Issues the default source of truth for planning artifacts.
- Implementing any new business logic outside of the skill packaging/discovery flow.

## Current Behavior

The repository currently documents a Day Shift planner workflow and ships a prompt template at `.pi/prompts/day-planner.md`. That workflow is advisory and draft-oriented, but it is not exposed as an inbuilt Pi skill.

There is no first-class packaged set of planning skills for:

- grilling a user on a plan (`grill-me`)
- producing a draft spec (`to-prd`)
- producing vertically sliced TODOs (`to-issues`)

The Nightmanager workflow continues to depend on local `TODOs.md` and `specs/` files.

## Desired Behavior

After installing `nightmanager`, Pi should discover three planning skills automatically with no extra user setup:

### `grill-me`

- Exists as a tiny skill with the exact short prompt the user approved.
- Interviews the user relentlessly about a plan or design until shared understanding is reached.
- Asks one question at a time.
- Uses codebase exploration when a question can be answered by inspecting the repository.
- Does not expand into documentation or workflow guidance beyond the concise prompt.

### `to-prd`

- Uses the current conversation and available repository context to write a draft spec.
- Produces a spec file in `specs/` using the existing spec format.
- Does not create TODOs as its primary output.
- Asks clarifying questions when requirements are underspecified instead of guessing.
- May inspect the codebase through Finder when that can resolve questions about current behavior.

### `to-issues`

- Reads an existing spec or plan and breaks it into multiple TODOs when appropriate.
- Writes local `TODOs.md` entries in the existing repository format.
- Creates vertically sliced, independently actionable TODOs rather than horizontal layer-only tasks.
- May create GitHub issues only when explicitly requested.
- Keeps Nightmanager compatibility by preserving the same TODO structure and status semantics used today.

## Acceptance Criteria

- [ ] `grill-me`, `to-prd`, and `to-issues` are packaged with `nightmanager` as inbuilt Pi skills.
- [ ] Pi discovers the skills automatically after install with no extra setup step.
- [ ] `grill-me` remains a tiny prompt matching the approved wording.
- [ ] `to-prd` creates draft specs in `specs/` using the existing spec template and format.
- [ ] `to-issues` creates local `TODOs.md` entries in the existing format by default.
- [ ] `to-issues` breaks a spec into multiple vertically scalable TODOs when the work is large enough to justify slices.
- [ ] GitHub issue creation is available only when explicitly requested and is not the default behavior.
- [ ] Existing Nightmanager docs and conventions remain compatible with the generated artifacts.

## Edge Cases

- A rough idea may be too underspecified for `to-prd`; in that case it should ask clarifying questions rather than guessing.
- A spec may be too large for a single TODO; `to-issues` should split it into thin vertical slices instead of producing one oversized item.
- A user may explicitly request GitHub issues from `to-issues`; that path should be supported without becoming the default.
- The repo must remain compatible with Nightmanager reading local `TODOs.md` entries even when planning starts from a skill flow.
- Skill discovery behavior may vary by Pi installation environment, so the packaging approach must not require manual post-install registration.

## Suggested Approach

- Package the three planning skills so Pi can discover them as part of the installed `nightmanager` extension.
- Keep `grill-me` as a minimal prompt-only skill file.
- Reuse the existing spec and TODO formats rather than introducing new templates.
- Make `to-prd` and `to-issues` explicitly align with the repo’s planning workflow: spec first, then TODO slices.
- Preserve the local-file-first model so Nightmanager can continue to operate without depending on GitHub issues.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build
```

Add any focused checks needed to confirm the skills are packaged and discoverable in the Pi environment.

## Documentation Updates

- Update repo docs to describe the new inbuilt planning skills.
- Update any workflow docs that mention the old Day Shift planner prompt-only flow.
- Update examples so users know how to invoke `grill-me`, `to-prd`, and `to-issues` after installing `nightmanager`.

## Risks / Open Questions

- Exact Pi skill packaging/discovery mechanics may require a repo-specific setup path.
- The selected mechanism must keep discovery automatic after install with no extra setup.
- If discovery cannot be fully automatic across all environments, the fallback experience needs to stay simple enough that the skills still feel inbuilt.
