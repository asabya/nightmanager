---
name: tdd
description: Test-driven development reference — what a good test is, where tests go, the anti-patterns, and the rules of the red → green loop. Reference material for /implement and the night shift, not a workflow of its own.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the **reference** that makes that loop produce tests worth keeping. It is consulted by `/implement` and by the night-shift worker; it does not drive its own workflow. Every section applies on every cycle — consult it before and during the loop, not after.

## What a good test is

Tests verify **behaviour through public interfaces**, not implementation details. Code can change entirely; a good test shouldn't. It reads like a specification — "selects the first eligible ready ticket" tells you exactly what capability exists — and survives refactors because it doesn't care about internal structure.

## Seams — where tests go

A **seam** is the public boundary you test at: the interface where you observe behaviour without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user (in the foreground) or take them from the spec's Testing Plan / Suggested Approach (in the night shift). You can't test everything — agreeing seams up front lands the effort on critical paths and complex logic instead of every edge case. Ask: "What's the public interface, and which seams should we test?"

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods, or checks a side channel. The tell: it breaks on a refactor when behaviour hasn't changed.
- **Tautological** — the assertion recomputes the expected value the way the code does, so it passes by construction. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing** — all tests first, then all implementation. Bulk tests verify *imagined* behaviour and go insensitive to real changes. Work vertically instead: one test → one implementation → repeat, each test a tracer bullet responding to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. No speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (`/code-review`), not the red → green cycle.

Validation commands come from the spec's `## Testing Plan` — that is Nightmanager's single validation source. In this repo the usual checks are `npm run typecheck` and `npm test` (narrow test files first, the full suite once at the end).
