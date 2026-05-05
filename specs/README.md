# specs

Day Shift planning docs for Nightmanager.

Rules:
- Start new specs from `TEMPLATE.md`.
- Keep unfinished specs as `draft-*.md`; Nightmanager ignores them.
- Promote TODOs to `[ready]` only after human review and only when linked to a complete non-draft spec. Use `to-ready` for promotion.
- Optimize specs for clear autonomous execution: testable acceptance, explicit validation, small scope.

## Drafts

- Filename: `draft-<title>.md`
- Linked TODOs stay `[draft]`
- Promotion: remove `draft-`, set `Status: active`, update linked TODOs to `[ready]`, create one clean promotion commit

## Readiness checklist

- Problem and desired behavior are clear
- Scope fits one focused Nightmanager TODO/commit
- Acceptance criteria are testable
- Edge cases and non-goals are documented
- `## Testing Plan` lists exact validation/manual checks, or says none are configured
- Open questions are resolved or explicitly deferred
