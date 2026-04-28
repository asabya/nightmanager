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
