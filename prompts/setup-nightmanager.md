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

1. Inspect the repository enough to understand its language, package manager, validation commands, and documentation layout.
2. Create `specs/` if it does not exist.
3. Create `specs/README.md` if it does not exist, using the guide below.
4. Create `specs/TEMPLATE.md` if it does not exist, using the template below.
5. Create `TODOs.md` if it does not exist, using the queue template below.
6. If files already exist, preserve existing work and only add missing Nightmanager sections after confirming the local format.
7. Prefer validation commands that actually exist in the repository. For npm projects, default to:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

8. End with a concise report listing files created/updated and any follow-up setup needed.

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
- Validation commands are listed
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

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Add narrower tests or manual checks here.

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

- `[bug]` — eligible; highest priority defect.
- `[ready]` — eligible for autonomous implementation.
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
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Notes: risks, constraints, or follow-ups.
-->
```

## Nightmanager Compatibility

- Keep unfinished specs as `specs/draft-*.md`.
- Keep unapproved TODOs as `[draft]`.
- Promote work to `[ready]` only after human review.
- Use `[bug]` only for urgent defects that are safe for autonomous implementation.
- Keep each TODO small enough for one focused implementation and commit.
