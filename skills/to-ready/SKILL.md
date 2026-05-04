---
name: to-ready
description: Promote draft Nightmanager specs and their draft TODOs to ready state, then commit only those promotion changes.
---

# To Ready

Promote reviewed Day Shift planning artifacts so `/nightmanager` can run.

When invoked, perform the promotion yourself using repository tools and Git. Do not only describe the steps.

## Inputs

- `/to-ready` with no argument: consider every `specs/draft-*.md` file.
- `/to-ready <slug>`: consider only `specs/draft-<slug>.md` by exact filename/slug match.
  - Match the draft spec filename/slug only, not spec title text or TODO text.
  - If there is no exact matching draft spec, stop with a clear `no matching draft spec` message and make no changes.

## Safety preflight

- Inspect the repo before editing.
- If the working tree already has uncommitted changes, stop and ask the user what to do first; do not include pre-existing changes in the promotion commit because you cannot guarantee they are promotion-only changes.
- The working tree must be clean after a successful run.

## Candidate validation

For each candidate draft spec, decide whether it can be promoted.

Skip and report a draft spec as invalid when any of these are true:

- The target non-draft filename already exists, e.g. `specs/<slug>.md` exists for `specs/draft-<slug>.md`.
- The spec still contains literal template placeholders such as `<title>`, `<human>`, `<yyyy-mm-dd>`, or another `<...>` placeholder.
- The spec still contains empty placeholder bullets, including bullets that are only `-` / `- ` or unchecked acceptance items that are only `- [ ]` / `- [ ] `.

Do not treat `- None`, explicit deferred open questions, or non-empty bullets as invalid.

## TODO association rules

- A draft TODO is associated with a draft spec only when the TODO entry:
  - is currently tagged `[draft]`, and
  - has an exact `Spec:` path pointing at that draft spec, for example:

    ```text
    - Spec: `specs/draft-<slug>.md`
    ```
- Promote only `[draft]` TODO entries associated with promoted specs.
- Do not change `[blocked]`, `[ready]`, `[bug]`, `[in-progress]`, `[done]`, or unrelated TODO entries.
- When promoting a TODO, change its tag from `[draft]` to `[ready]` and rewrite its `Spec:` path to the new non-draft spec filename.
- If a candidate draft spec has no associated `[draft]` TODOs, skip it and tell the user to run `to-issues` for that spec.
  - For bare `/to-ready`, still promote other valid candidates that do have draft TODOs.
  - For `/to-ready <slug>`, make no changes for that slug and tell the user to run `to-issues`.

## Promotion edits

For each promotable candidate:

1. Rename `specs/draft-<slug>.md` to `specs/<slug>.md` using Git-aware file movement when possible.
2. In the promoted spec, change `Status: draft` to exactly `Status: active`.
3. In `TODOs.md`, update only associated draft TODO entries:
   - `[draft]` -> `[ready]`
   - `Spec: specs/draft-<slug>.md` -> `Spec: specs/<slug>.md` while preserving TODO markdown backticks around the path.

## Commit

After making promotion edits:

- Stage only the promoted spec renames/content changes and the corresponding `TODOs.md` changes.
- Create one commit for the promotion changes.
- Use this commit message format, with promoted slugs joined by commas:

```text
promoting x,y,z specs
```

Example:

```text
promoting implement-auth,session-timeout specs
```

- If there are no promotable candidates, make no commit.
- Verify `git status --short` is clean after a successful commit.

## Final response

Report concisely:

- promoted specs
- TODOs changed to `[ready]`
- commit hash, when a commit was created
- skipped/invalid draft specs and the reason, including `run to-issues` when applicable
