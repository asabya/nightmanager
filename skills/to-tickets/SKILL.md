---
name: to-tickets
description: Break a spec, plan, or conversation into vertically-sliced Nightmanager tickets — local TODOs.md entries, each declaring what it delivers and what blocks it.
---

# To Tickets

Break a spec, plan, or conversation into **tickets** — tracer-bullet vertical slices. In Nightmanager a ticket is a local `TODOs.md` entry; "ticket" and "TODO" are the same thing here.

## Process

### 1. Gather context

Work from the conversation. If the user passes a spec path or slug, read that spec's full body first. Prefer a non-draft or `specs/draft-<slug>.md` spec as the `Spec:` reference.

### 2. Explore the codebase (optional)

Inspect current code so titles and descriptions use the project's real vocabulary. Look for prefactoring that makes the change easy — "make the change easy, then make the easy change."

### 3. Draft vertical slices

- Each slice cuts a narrow but **complete** path through every layer it touches (logic, wiring, tests) — vertical, not a horizontal layer-only task.
- A completed slice is independently demoable or verifiable.
- Each slice fits one focused implementation pass / one fresh context window.
- Prefactoring goes first.

Give each ticket its **blocking edges** — the other tickets that must finish before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception.** A mechanical change whose blast radius fans across the codebase (rename a shared symbol, retype a field) can't land green as one vertical slice. Sequence it expand → migrate-in-batches → contract: add the new form beside the old, migrate call sites in batches (each its own ticket, each keeping validation green because the old form still exists), then delete the old form once no caller remains.

### 4. Quiz the user

Present the breakdown as a numbered list. For each ticket show: **Title**, **Blocked by**, and **What it delivers** (the end-to-end behaviour, from the user's perspective — not a layer list). Ask whether the granularity is right, the blocking edges are correct, and whether any ticket should merge or split. Iterate until the user approves.

### 5. Write the tickets into `TODOs.md`

Append the approved tickets to the repo's local `TODOs.md`, in dependency order (blockers first), using the existing queue format. Do **not** create GitHub issues unless the user explicitly asks.

Follow Nightmanager conventions:

- Default to `[draft]`; use `[ready]` only if the user explicitly approves it. Promotion is `to-ready`'s job.
- Reference the source spec with an exact backticked ``Spec: `specs/draft-<slug>.md` `` line so `to-ready` and the night shift can batch them.
- Give each ticket runnable acceptance criteria and a Validation block; if a spec's Testing Plan already defines validation, point at it rather than inventing commands.
- Record blocking edges as a `Blocked by:` bullet listing the blocking ticket titles (or "None — can start immediately"). Tickets that are genuinely gated should also carry `[blocked]` until their blockers land.
- Do not modify unrelated existing TODO entries.

Ticket shape (match the existing `TODOs.md` entries):

```markdown
- [draft] <Ticket title>
  - Spec: `specs/draft-<slug>.md`
  - Blocked by: <blocking ticket titles, or "None — can start immediately">
  - Scope: the end-to-end behaviour this ticket makes work, from the user's perspective.
  - Acceptance:
    - <criterion 1>
    - <criterion 2>
  - Validation:
    - npm run typecheck
    - npm test
  - Notes: likely files, prefactoring, or risks.
```

Avoid file paths and code snippets in the ticket body — they go stale. Work the frontier one ticket at a time with `/implement` (or let the night shift batch them), clearing context between tickets.
