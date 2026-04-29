# TODOs

Nightmanager implementation queue.

## Status Tags

- `[bug]` — eligible; highest priority defect. May omit a linked spec; Nightmanager then uses `specs/TEMPLATE.md ## Testing Plan`.
- `[ready]` — eligible for autonomous implementation only when linked to a non-draft spec.
- `[draft]` — not eligible; still being planned. Created by Day Shift planner or human. Human must promote it to `[ready]` before Nightmanager can pick it up.
- `[blocked]` — not eligible until the reason is resolved.
- `[in-progress]` — currently being worked.
- `[done]` — complete; include commit hash once available. Include PR URL only when PR creation succeeds.

## Queue

- [done] Add PR-aware Nightmanager cycle prompt
  - Spec: `specs/afk-pr-creation.md`
  - Scope: update the `/nightmanager` execution prompts so one eligible TODO becomes one branch, one commit, and one ready-for-review PR when possible.
  - Acceptance:
    - Nightmanager requires a clean working tree before starting and stops on pre-existing uncommitted changes.
    - The cycle creates/switches to a sanitized TODO-title branch before implementation, with `-2` / `-3` suffixes for local or `origin` collisions.
    - Successful validation leads to one commit, immediate `[done]` TODO update, push to `origin`, and `gh pr create` for a normal PR.
    - Failed validation leaves uncommitted implementation changes in place and does not commit, push, or open a PR.
    - PR creation failures after commit produce a clear local-commit fallback report with the exact `git`/`gh` reason.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: 8b88a3052ecacb2a2adada22dc27518f56b375bd
  - Notes: likely files include `prompts/nightmanager.md`, `prompts/agent-loop.md`, and `prompts/agents.md`.

- [done] Standardize TODO done metadata for PR fallback
  - Spec: `specs/afk-pr-creation.md`
  - Scope: document and apply a consistent TODO completion format that records commit hash and PR URL when available.
  - Acceptance:
    - `TODOs.md` guidance supports `[done]` entries with commit hash and optional PR URL.
    - Nightmanager prompt instructions say to include commit hash always and PR URL only when PR creation succeeds.
    - Local-commit fallback behavior is reflected in the final report format.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: 024c90a4c88ab37c7ed997406ee31fda4ea092b8
  - Notes: keep the format local-file-first and do not require GitHub issue creation.

- [done] Reposition README around The Nightmanager Loop
  - Spec: `specs/nightmanager-loop-positioning.md`
  - Scope: rewrite the README intro and quick-start narrative around the loop: `grill-me → to-prd → to-issues → /nightmanager`.
  - Acceptance:
    - README leads with “Stop babysitting agents. Give them shared understanding.” or an approved close variant.
    - The Nightmanager Loop is explained before the Finder/Oracle/Worker/Manager tool table.
    - Subagents are framed as AFK implementation machinery inside the loop, not the whole product.
    - Copy avoids claiming GitHub issue creation by default and says humans review PRs rather than Nightmanager merging them.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: 922389688702a7a2ff28a632ed403f06a0f0c016
  - Notes: keep PR claims consistent with the PR creation spec implementation status.

- [done] Reposition public site around The Nightmanager Loop
  - Spec: `specs/nightmanager-loop-positioning.md`
  - Scope: update `docs/index.html` hero, meta description, workflow section, and subagent cards to match the new loop-first positioning.
  - Acceptance:
    - Public site hero emphasizes less babysitting and shared understanding.
    - The primary workflow appears in order: grill intent, generate/refine spec, slice work, delegate AFK implementation.
    - Subagent cards remain present but secondary to the loop.
    - Site copy avoids automatic merge/deploy claims and avoids implying GitHub issues are default.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: e730e75e5903977ebe1914e9fa0e0913e7f29a1f
  - PR: https://github.com/asabya/nightmanager/pull/5
