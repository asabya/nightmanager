---
name: to-spec
description: Turn the current conversation into a draft local spec in specs/ using this repository's spec template and Nightmanager conventions. Synthesis, not an interview.
---

# To Spec

Take the current conversation, idea, and codebase understanding and synthesise a **draft spec** under `specs/` using the structure from `specs/TEMPLATE.md`. This document is a broad specification (you may know it as a PRD), not a strict product-requirements form.

Do not run an interview here — that is `grill-me`'s job. Synthesise what you already know. Only ask a question when a required section cannot be written without a decision the conversation never settled.

## Process

1. **Inspect the repo** to ground the spec in current behaviour and likely implementation areas. Use the project's existing vocabulary and respect anything the surrounding specs establish.

2. **Sketch the test seams.** Decide where the feature will be observed and tested — prefer existing seams to new ones, and the highest seam possible. The fewer seams, the better; the ideal is one. Record them in the spec's Testing Plan / Suggested Approach. If a new seam is needed, briefly check it matches the user's expectations.

3. **Write `specs/draft-<slug>.md`** (unless the user names a file) filling every section of `specs/TEMPLATE.md` with concrete, testable content:
   - Keep `Status: draft` and the `draft-` prefix — promotion to active is `to-ready`'s job, not this skill's.
   - Fill Acceptance Criteria and Testing Plan with real, runnable checks. The Testing Plan is Nightmanager's single validation source for this spec, so make its commands exact.
   - Do not paste file paths or code snippets that will go stale; describe decisions in prose. Exception: a small snippet that encodes a decision more precisely than prose (a schema, type shape, state machine) may be inlined.

## Rules

- Local-file-first: the draft spec is the only primary output. Do not create `TODOs.md` entries or GitHub issues here — that is `to-tickets`.
- Leave no template placeholders (`<title>`, `<human>`, `<yyyy-mm-dd>`, empty bullets); `to-ready` will refuse to promote a spec that still has them.
- If the user explicitly asks for a TODO candidate too, add it as `[draft]` only, never `[ready]`.
