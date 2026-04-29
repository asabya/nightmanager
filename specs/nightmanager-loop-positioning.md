# Spec: Nightmanager Loop marketing and branding

Status: ready
Owner: human
Created: 2026-04-29

## Problem

Nightmanager is currently positioned mostly as four Pi subagent tools: Finder, Oracle, Worker, and Manager. That undersells the stronger product story: Nightmanager is a spec-driven loop that turns vague human intent into shared understanding, vertical slices, delegated implementation, and AFK PRs. For solo developers, the sharper pain is not simply needing more agents; it is needing agents that stop misunderstanding requirements, stop burning main context, and stop accelerating codebase entropy.

## Goals

- Reposition Nightmanager around **The Nightmanager Loop**, not just individual subagents.
- Lead with the solo developer wedge while remaining broadly understandable to teams and founders.
- Use the hero idea: **“Stop babysitting agents. Give them shared understanding.”**
- Explain the loop in this order:
  1. Grill the intent.
  2. Generate/refine the spec.
  3. Slice into issues/TODOs.
  4. Delegate to subagents for AFK implementation.
- Make the promise compatible with the PR launch blocker: come back to reviewable PRs once AFK PR creation ships.
- Show that specs are the source of shared understanding between the human and the agent.

## Non-Goals

- Do not market Nightmanager as a generic replacement for all coding agents.
- Do not claim automatic merging or production deployment.
- Do not hide the subagents; reframe them as execution machinery inside the loop.
- Do not claim GitHub issue creation by default if the product remains local `TODOs.md` first.
- Do not overpromise multi-agent autonomy without spec/readiness guardrails.

## Current Behavior

Relevant current files:

- `README.md` opens with “Four specialized Pi tools for intelligent delegation” and immediately lists Finder, Oracle, Worker, and Manager.
- `docs/index.html` similarly positions Nightmanager around a multi-specialist team and tool cards.
- `skills/grill-me/SKILL.md` defines the clarification interview that reveals hidden requirements.
- `skills/to-prd/SKILL.md` turns rough ideas into draft specs under `specs/`.
- `skills/to-issues/SKILL.md` turns specs/plans into vertically sliced local `TODOs.md` entries.
- `prompts/agent-loop.md` already contains the deeper Day Shift / Nightmanager story, but this is not yet the top-level marketing message.
- `prompts/nightmanager.md` defines autonomous execution of one ready TODO through Manager.

The current public story emphasizes subagents more than the end-to-end loop.

## Desired Behavior

The README and public site should make the loop the primary product story.

Recommended hero copy:

> Stop babysitting agents. Give them shared understanding.

Recommended subheadline:

> Nightmanager grills your intent, turns it into agent-ready specs and vertical slices, then delegates implementation so you can come back to reviewable PRs.

Recommended loop framing:

### The Nightmanager Loop

1. **Grill the intent** — use `grill-me` to interrogate a feature, bug, or plan one question at a time until hidden requirements, risks, and trade-offs are surfaced.
2. **Generate/refine the spec** — use `to-prd` to turn the clarified conversation into a concrete local spec with goals, non-goals, acceptance criteria, edge cases, testing, and risks.
3. **Slice the work** — use `to-issues` to break the spec into small, vertical, independently grabbable TODOs that are safe for one focused implementation pass.
4. **Delegate AFK implementation** — run Nightmanager to select one ready TODO and delegate through Manager, Finder, Oracle, and Worker to implement, validate, commit, and open a PR for human review.

Supporting messages:

- The most common failure mode in software development is misalignment: you think the agent/dev understood you, then the output proves otherwise.
- Agent speed can accelerate software entropy unless work is constrained by specs, vertical slices, tests, and reviewable PRs.
- Nightmanager reduces babysitting by creating a shared spec before execution.
- Subagents preserve main-session context by doing focused work in isolated roles.
- The spec is the source of shared understanding; subagents are the execution team.

## Acceptance Criteria

- [ ] `README.md` hero/intro leads with The Nightmanager Loop rather than “four specialized Pi tools.”
- [ ] `docs/index.html` hero and primary sections use the loop-first positioning.
- [ ] The copy includes the line “Stop babysitting agents. Give them shared understanding.” or a close approved variant.
- [ ] The loop is presented in the order `grill-me → to-prd → to-issues → Nightmanager delegation`.
- [ ] Subagents are still explained, but as part of the AFK implementation step rather than the whole product.
- [ ] The page clearly states that humans review PRs; Nightmanager does not merge automatically.
- [ ] The messaging avoids saying GitHub issues are created by default; it can mention local TODOs or vertical slices unless GitHub issue support is explicitly added.
- [ ] The message for solo developers is clear within the first screen: less babysitting, better alignment, reviewable output.

## Edge Cases

- If AFK PR creation is not yet implemented, public launch copy should not promise PRs until the PR spec is complete.
- If the docs mention local commits in some places and PRs in others, users may see the product as inconsistent; update all top-level docs together.
- The word “issues” may imply GitHub issues; prefer “vertical slices” or “TODOs” unless GitHub issue creation is explicitly supported.
- “AFK implementation” can sound unsafe; pair it with specs, validation, one TODO per PR, and human review.

## Suggested Approach

- Update `README.md` first because it is the source for package users and likely GitHub visitors.
- Update `docs/index.html` after the README copy is approved.
- Keep a compact “Subagents” section below the loop:
  - Finder: codebase discovery.
  - Oracle: reasoning/debugging.
  - Worker: implementation/verification.
  - Manager: orchestration/handoff.
- Add a simple flow diagram or text strip:

```text
grill-me → to-prd → to-issues → /nightmanager → PR for review
```

- Use examples that start from a vague feature/bug request and end with a ready-for-review PR.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Additional validation:

- Manually review README and public site for consistency with actual behavior.
- Confirm no copy promises automatic merge/deploy.
- Confirm no copy says GitHub issues are created by default.
- Confirm PR claims only ship after the AFK PR creation spec is implemented.

## Documentation Updates

- `README.md`: rewrite intro, quick intro, and workflow sections around The Nightmanager Loop.
- `docs/index.html`: update hero, meta description, primary CTA copy, workflow section, and subagent cards.
- `package.json`: consider updating `description` after copy is stable.
- `prompts/agent-loop.md`: optionally align terminology with the marketing loop.

## Risks / Open Questions

- Exact final hero line and subheadline still need approval after seeing them in context.
- Need to decide whether to call the third stage “issues,” “TODOs,” or “vertical slices” in public copy.
- The PR promise depends on `specs/afk-pr-creation.md` being implemented before launch.
