# Setup Nightmanager Project Files

Use this prompt to initialize a repository for the Nightmanager workflow.

## Goal

Create or update the local planning files needed for autonomous, reviewable implementation:

- `specs/`
- `specs/README.md`
- `specs/TEMPLATE.md`
- `TODOs.md`

Do not implement product code while running this setup prompt.

## Instructions

1. Inspect the repository enough to understand its language, package manager, task runners, CI validation commands, and documentation layout.
2. Determine the repository default Testing Plan once during setup:
   - Prefer explicit project commands that already exist in repo-local task runners, manifests, or CI configuration.
   - Prefer safe validation commands such as test, typecheck, lint, vet, check, build, or format-check commands.
   - Avoid destructive, deploy, publish, release, migration, or external-service commands.
   - If multiple plausible command sets exist or the right command is unclear, ask the user to confirm or edit the Testing Plan before writing it.
   - If no automated validation command is configured or safely inferable, use the explicit no-validation marker shown in the template.
3. Create `specs/` if it does not exist.
4. Create `specs/README.md` if it does not exist, using the guide below.
5. Create `specs/TEMPLATE.md` if it does not exist, using the template below and replacing the Testing Plan placeholder with the setup-time repository default.
6. If `specs/TEMPLATE.md` already exists and still contains the old hardcoded npm Testing Plan, replace only that old hardcoded block with the setup-time repository default.
7. Do not change an existing custom `specs/TEMPLATE.md` Testing Plan.
8. Create `TODOs.md` if it does not exist, using the queue template below.
9. If files already exist, preserve existing work and only add missing Nightmanager sections after confirming the local format.
10. End with a concise report listing files created/updated, whether the Testing Plan was created/replaced/preserved, and any follow-up setup needed.

## `specs/README.md`

```md
# specs

This directory contains Day Shift planning documents for Nightmanager implementation.

Rules:

- Use `TEMPLATE.md` for new specs.
- Prefix unfinished specs with `draft-`; autonomous runs must ignore them.
- Only add a TODO as `[ready]` when the linked spec is complete enough to implement without live human steering.
- Keep specs organized for human thinking first. Good specs reduce agent babysitting.

## Draft specs

Draft specs are created by Day Shift planning skills or human planning sessions:

- Filename format: `draft-<title>.md`
- Nightmanager ignores specs with `draft-` prefix
- TODOs linked to draft specs should be tagged `[draft]`
- Human must review and manually promote: remove `draft-` from filename, change TODO to `[ready]`

## Readiness Checklist

Before promoting a draft spec, human must confirm:

- Problem and desired behavior are clear
- Scope is small enough for one Nightmanager TODO
- Acceptance criteria are testable
- Edge cases and non-goals are documented
- The linked spec includes a `## Testing Plan` section
- Open questions are resolved or explicitly deferred
```

## `specs/TEMPLATE.md`

```md
# Spec: <title>

Status: draft
Owner: <human>
Created: <yyyy-mm-dd>

## Problem

What user or maintainer problem are we solving? Why now?

## Goals

- 

## Non-Goals

- 

## Current Behavior

Describe the relevant current behavior and files/modules if known.

## Desired Behavior

Describe the target behavior in enough detail that an agent can test it.

## Acceptance Criteria

- [ ] 
- [ ] 
- [ ] 

## Edge Cases

- 

## Suggested Approach

Optional. Include architectural guidance, likely files, trade-offs, and rejected alternatives.

## Testing Plan

<!-- setup-nightmanager replaces this section with the repository default. If no automated validation is configured, use:

No automated validation commands configured for this repository.

Add manual checks or project-specific commands when this spec requires them.
-->

## Documentation Updates

List docs, README sections, examples, or comments that should change.

## Risks / Open Questions

- 
```

## `TODOs.md`

```md
# TODOs

Nightmanager implementation queue.

## Status Tags

- `[bug]` — eligible; highest priority defect. May omit a linked spec; Nightmanager then uses `specs/TEMPLATE.md ## Testing Plan`.
- `[ready]` — eligible for autonomous implementation only when linked to a non-draft spec.
- `[draft]` — not eligible; still being planned. Created by Day Shift planner or human. Human must promote it to `[ready]` before Nightmanager can pick it up.
- `[blocked]` — not eligible until the reason is resolved.
- `[in-progress]` — currently being worked.
- `[done]` — complete; include commit hash once available. Include PR URL only when PR creation succeeds.

## Queue

<!--
Example:

- [draft] Add concise feature title
  - Spec: `specs/draft-feature-title.md`
  - Scope: one independently reviewable vertical slice.
  - Acceptance:
    - Observable, testable behavior.
  - Notes: risks, constraints, or follow-ups. Validation comes from the linked spec's Testing Plan.
-->
```

## Nightmanager Compatibility

- Keep unfinished specs as `specs/draft-*.md`.
- Keep unapproved TODOs as `[draft]`.
- Promote work to `[ready]` only after human review and after linking a non-draft spec.
- Use `[bug]` only for urgent defects that are safe for autonomous implementation.
- Keep each TODO small enough for one focused implementation and commit.
