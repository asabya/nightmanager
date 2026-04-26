# Specs

This directory contains Day Shift planning documents for Night Shift implementation.

Rules:

- Use `TEMPLATE.md` for new specs.
- Prefix unfinished specs with `draft-`; autonomous runs must ignore them.
- Only add a TODO as `[ready]` when the linked spec is complete enough to implement without live human steering.
- Keep specs organized for human thinking first. Good specs reduce agent babysitting.

## Draft Specs

Draft specs are created by the Day Shift planner workflow (see `.pi/prompts/day-planner.md`):

- Filename format: `draft-<title>.md`
- Night Shift ignores specs with `draft-` prefix
- TODOs linked to draft specs should be tagged `[draft]`
- Human must review and manually promote: remove `draft-` from filename, change TODO to `[ready]`

## Readiness Checklist

Before promoting a draft spec, human must confirm:

- Problem and desired behavior are clear
- Scope is small enough for one Night Shift TODO
- Acceptance criteria are testable
- Edge cases and non-goals are documented
- Validation commands are listed
- Open questions are resolved or explicitly deferred
