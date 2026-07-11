---
name: implement
description: Implement one ready ticket or spec interactively in the foreground — the attended alternative to the AFK /nightmanager night shift. TDD where seams allow, then code review, then commit.
---

# Implement

Implement the work described by a spec or a `TODOs.md` ticket, **interactively, in the foreground**, with the human present.

This is Nightmanager's attended path. The AFK path is `/nightmanager`, which batches and delegates the same tickets to subagents unattended. Both draw from the same `TODOs.md` queue, so coordination matters (see **Queue coordination**).

## Select the work

- If the user names a ticket or spec, use it.
- Otherwise pick the first eligible ticket from `TODOs.md`: a `[bug]`, or a `[ready]` linked to a non-draft spec. Skip `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`.
- Read the linked spec (or `specs/TEMPLATE.md ## Testing Plan` for a spec-less `[bug]`). The spec's Testing Plan is the only validation source — do not invent commands.

## Queue coordination — claim the ticket first

Before doing any work, **flip the ticket to `[in-progress]` in `TODOs.md` and save it.** The status tag is the lock: the night shift skips `[in-progress]` tickets, so this prevents `/nightmanager` from double-picking what you are actively building. If you abandon the work, set it back to its prior tag so it becomes eligible again.

## Implement

- Use `finder` for unfamiliar code and `oracle` for ambiguity, failures, or trade-offs — but keep implementation in the foreground where the human can steer. (Handing the whole ticket to `manager` is the AFK route; that is `/nightmanager`'s job, not this skill's.)
- Prefer TDD where the seams allow. Follow `/tdd`: agree the seams first, then red → green one slice at a time. Refactoring is deferred to the review step, not folded into each loop.
- Make the smallest correct change; update tests and docs as the ticket requires.
- Run typechecking regularly and single test files as you go. Run the full test suite **once at the end**.

## Review, then commit

1. When the work is green, run `/code-review` on it (Standards + Spec axes).
2. Address what the review surfaces.
3. Commit to the current branch with a useful message. Then update the ticket to `[done]` with the commit hash, following the `TODOs.md` convention.

Foreground `/implement` commits to the current branch and leaves branching/PR to the human — it does not push or open a PR (that is the night shift's behaviour). If validation fails, leave the change uncommitted for review and report; do not commit broken work.
