# Setup Nightmanager Project Files

Initialize a repo for Nightmanager autonomous, reviewable implementation. Create/update only planning files: `specs/`, `specs/README.md`, `specs/TEMPLATE.md`, `TODOs.md`. Do not implement product code.

## Instructions

1. Inspect enough to identify language, package manager, task runners, CI validation, and docs layout.
2. Determine the default `## Testing Plan` once:
   - Prefer existing safe repo/CI commands: test, typecheck, lint, vet, check, build, format-check.
   - Avoid deploy, publish, release, migrations, destructive/external-service commands.
   - If ambiguous, ask the user to confirm/edit before writing.
   - If none are safe/configured, use the no-validation marker in the template.
3. Create `specs/` if missing.
4. Create `specs/README.md` if missing, using the guide below.
5. Create `specs/TEMPLATE.md` if missing, replacing the Testing Plan placeholder with the default.
6. If `specs/TEMPLATE.md` still has the old hardcoded npm Testing Plan, replace only that block with the default.
7. Preserve existing custom Testing Plans.
8. Create `TODOs.md` if missing, using the queue template below.
9. If files exist, preserve work and add only missing Nightmanager sections after confirming local format.
10. Report files changed, whether Testing Plan was created/replaced/preserved, and follow-up setup.

## `specs/README.md`

```md
# specs

Day Shift planning documents for Nightmanager.

Rules:
- Use `TEMPLATE.md` for new specs.
- Prefix unfinished specs `draft-`; Nightmanager ignores them.
- Promote TODOs to `[ready]` only when linked to a complete non-draft spec; `to-ready` can promote reviewed drafts.
- Specs optimize human thinking first; good specs reduce agent babysitting.

## Draft specs

- Filename: `draft-<title>.md`
- TODOs linked to drafts stay `[draft]`
- Human review + `to-ready`: remove `draft-`, set `Status: active`, mark TODOs `[ready]`, make one promotion commit

## Readiness Checklist

- Problem/desired behavior clear
- Scope small enough for one Nightmanager TODO
- Acceptance criteria testable
- Edge cases/non-goals documented
- Includes `## Testing Plan`
- Open questions resolved or deferred
```

## `specs/TEMPLATE.md`

```md
# Spec: <title>

Status: draft
Owner: <human>
Created: <yyyy-mm-dd>

## Problem

What problem are we solving, and why now?

## Goals

- 

## Non-Goals

- 

## Current Behavior

Relevant current behavior and likely files/modules, if known.

## Desired Behavior

Target behavior in enough detail that an agent can test it.

## Acceptance Criteria

- [ ] 
- [ ] 
- [ ] 

## Edge Cases

- 

## Suggested Approach

Optional guidance, likely files, trade-offs, rejected alternatives.

## Testing Plan

<!-- setup-nightmanager replaces this with the repo default. If no automated validation is configured, use:

No automated validation commands configured for this repository.

Add manual checks or spec-specific commands when needed.
-->

## Documentation Updates

Docs, README sections, examples, or comments that should change.

## Risks / Open Questions

- 
```

## `TODOs.md`

```md
# TODOs

Nightmanager implementation queue.

## Status Tags

- `[bug]` — eligible urgent defect; may omit spec and then uses `specs/TEMPLATE.md ## Testing Plan`.
- `[ready]` — eligible only with a non-draft linked spec.
- `[draft]` — not eligible until human-promoted.
- `[blocked]` — not eligible until reason resolved.
- `[in-progress]` — currently being worked.
- `[done]` — complete; include commit hash, and PR URL only if PR creation succeeds.

## Queue

<!--
- [draft] Add concise title
  - Spec: `specs/draft-title.md`
  - Scope: one reviewable vertical slice.
  - Acceptance:
    - Observable, testable behavior.
  - Notes: risks/constraints/follow-ups. Validation comes from the spec Testing Plan.
-->
```

## Compatibility

Keep unfinished specs as `specs/draft-*.md`, unapproved TODOs as `[draft]`, and promoted work as small `[ready]` TODOs linked to non-draft specs. Use `[bug]` only for urgent safe defects. Keep each TODO one focused commit.
