---
name: to-ready
description: Promote draft Nightmanager specs and their draft TODOs to ready state, then commit only those promotion changes.
---

# To Ready

Promote reviewed Day Shift artifacts so `/nightmanager` can run. Perform the edits and Git commit; do not just describe them.

## Selection

- `/to-ready`: consider all `specs/draft-*.md`.
- `/to-ready <slug>`: consider only exact `specs/draft-<slug>.md`; if missing, stop with `no matching draft spec` and make no changes.

## Safety

- Inspect repo first.
- If the working tree has pre-existing uncommitted changes, stop and ask what to do; do not mix them into the promotion commit.
- After success, working tree must be clean.

## Promote only valid candidates

Skip/report a draft when:
- target `specs/<slug>.md` already exists;
- placeholders remain (`<title>`, `<human>`, `<yyyy-mm-dd>`, other `<...>`);
- empty placeholder bullets remain (`-`, `- `, `- [ ]`, `- [ ] `).

Do not reject `- None`, explicit deferred questions, or non-empty bullets.

## TODO association

A TODO belongs to a draft spec only when it is `[draft]` and has exact `Spec: ` path `specs/draft-<slug>.md` in backticks. Promote only those TODOs:
- `[draft]` -> `[ready]`
- `Spec: specs/draft-<slug>.md` -> `Spec: specs/<slug>.md`

Do not alter `[blocked]`, `[ready]`, `[bug]`, `[in-progress]`, `[done]`, or unrelated TODOs. If no associated `[draft]` TODO exists, skip and say `run to-issues` (for exact slug, make no changes).

## Edits and commit

For each promotable slug:
1. Git-move `specs/draft-<slug>.md` to `specs/<slug>.md`.
2. Change `Status: draft` to `Status: active`.
3. Update only associated TODO entries.
4. Stage only those spec/TODO changes.
5. Commit once: `promoting x,y,z specs`.

If nothing promotable, make no commit.

## Final response

Report promoted specs, TODOs changed, commit hash if created, and skipped/invalid drafts with reasons.
