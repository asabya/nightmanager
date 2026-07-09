---
name: code-review
description: Two-axis review of a diff — Standards (does it follow the repo's conventions and avoid code smells?) and Spec (does it implement what the ticket/spec asked?). Runs the axes as parallel sub-agents. Use to review a branch, PR, or work-in-progress.
---

# Code Review

Review the diff between `HEAD` and a fixed point along **two independent axes**:

- **Standards** — does the code follow this repo's conventions and the shared review lenses (including the Fowler code-smell baseline)?
- **Spec** — does the code faithfully implement the originating ticket / spec?

The two axes run as **parallel sub-agents** so they don't pollute each other's context; this skill then reports them side by side. A change can pass one and fail the other (right thing built wrong, or wrong thing built cleanly), so the axes are never merged or re-ranked.

The shared criteria live in Nightmanager's `prompts/review-personas.md` — the single source of truth for the review lenses and the code-smell baseline. This skill orchestrates; that prompt defines what "good" means.

## Process

### 1. Pin the fixed point

Use whatever fixed point the user gives (a SHA, branch, tag, `main`, `HEAD~5`). If none, ask. Capture `git diff <fixed-point>...HEAD` (three-dot, against the merge-base) and `git log <fixed-point>..HEAD --oneline`. Confirm the ref resolves and the diff is non-empty before spawning sub-agents — a bad ref or empty diff should fail here.

### 2. Identify the spec source

Find the originating spec, in order: issue references in the commit messages; a path the user passed; a spec under `specs/` matching the branch/feature; else ask. If there is genuinely no spec, the Spec sub-agent skips and reports "no spec available".

### 3. Spawn both sub-agents in parallel

Send one message with two `general-purpose` (or `oracle`) sub-agent calls.

**Standards sub-agent** — give it the diff command, the commit list, the repo's documented standards (if any), and the **shared review lenses + Fowler smell baseline from `prompts/review-personas.md`, pasted in full** (the sub-agent has no other access to it). Brief: "Report per file/hunk — (a) each place the diff breaks a documented repo standard (cite it); (b) any smell from the baseline (name it, quote the hunk). Documented repo standards are hard calls and override the baseline; baseline smells are always judgement calls. Skip anything tooling already enforces. Under 400 words."

**Spec sub-agent** — give it the diff command, commit list, and the spec contents. Brief: "Report — (a) spec requirements missing or partial; (b) behaviour not asked for (scope creep); (c) requirements implemented but implemented wrong. Quote the spec line for each finding. Under 400 words."

### 4. Aggregate

Present the reports under `## Standards` and `## Spec`, verbatim or lightly cleaned. Do not merge or re-rank across axes. End with a one-line summary: findings per axis and the worst issue within each axis — no single cross-axis "winner".

## Relationship to the night shift

`/nightmanager` applies the same review lenses inline before it commits (embedded in `prompts/nightmanager.md`, mirrored from `prompts/review-personas.md`). This skill is the on-demand, foreground equivalent used by `/implement` and by humans reviewing a branch or PR.
