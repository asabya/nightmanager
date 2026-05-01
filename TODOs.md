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

- [done] Add Nightmanager helpers for spec-batch selection and branch names
  - Spec: `specs/nightmanager-spec-batched-execution-loop.md`
  - Scope: select the first eligible TODO, identify the active batch by exact `Spec:` path, and derive branch slugs from the spec basename or TODO title for bug-only runs.
  - Acceptance:
    - The first eligible TODO determines the active batch.
    - TODOs sharing the exact same `Spec:` path resolve to the same active batch.
    - Spec-backed branches use the spec basename, with no `nightmanager/` prefix.
    - Local and `origin` collisions append `-2`, `-3`, etc. until the name is free.
    - Bug-only TODOs without a spec derive their branch from the TODO title.
    - Empty slugs stop the run with a clear error.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: 5601f66
  - PR: https://github.com/asabya/nightmanager/pull/6
  - Notes: likely files include `scripts/nightmanager.sh` and any small helper extracted for TODO parsing / branch checks.

- [done] Trim Nightmanager context loading to the active spec batch
  - Spec: `specs/nightmanager-spec-batched-execution-loop.md`
  - Scope: replace the broad preload of every non-draft spec with a minimal prompt/context set plus only the active spec needed for the selected batch.
  - Acceptance:
    - The runner no longer loads every spec file into context.
    - The active spec file is loaded for the selected batch.
    - Shared Nightmanager docs remain loaded, but unrelated specs do not.
    - The prompt files describe the minimal active-batch workflow rather than the old one-TODO-only story.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: 3601e9a
  - Notes: likely files include `scripts/nightmanager.sh`, `prompts/nightmanager.md`, `prompts/agent-loop.md`, and `prompts/agents.md`.

- [done] Batch same-spec TODOs through one branch and one PR per spec
  - Spec: `specs/nightmanager-spec-batched-execution-loop.md`
  - Scope: keep Nightmanager on the active spec until every TODO for that exact `Spec:` path is complete, while still committing each TODO separately and opening one PR per spec.
  - Acceptance:
    - TODOs with the same exact `Spec:` path stay on the same branch for the whole batch.
    - Nightmanager does not switch to another spec until the active spec has no remaining non-done TODOs.
    - Each TODO still lands as its own commit.
    - One PR is opened per completed spec batch.
    - After a spec batch completes, Nightmanager returns to the starting branch before continuing.
    - `[bug]` TODOs without a spec still run as one-TODO branches.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: 3b782036b441838c289a9c778817cf85ff59f63f
  - PR: https://github.com/asabya/nightmanager/pull/10
  - Notes: likely files include `scripts/nightmanager.sh`, `scripts/worktree-nightmanager.sh`, and prompt/reporting paths that describe the cycle.

- [done] Capture live usage snapshots in the subagent transcript
  - Spec: `specs/live-subagent-usage-labels.md`
  - Scope: add live usage state to isolated subagent runs and transcript details so built-in subagent invocations can stream their own token/cost totals while running, including partial values on failure or cancellation.
  - Acceptance:
    - `runIsolatedSubagent` and transcript state carry live usage snapshots.
    - Built-in subagents can expose partial `input` / `output` / `cache` / `cost` totals before completion.
    - Failed or cancelled runs preserve the last partial usage snapshot.
    - No child-subagent rollups are introduced; each invocation stays isolated.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Commit: 04af8da
  - PR: https://github.com/asabya/nightmanager/pull/7
  - Notes: likely files include `src/core/subagent.ts`, `src/core/transcript.ts`, and subagent tool update paths.

- [done] Render Pi-style usage labels on built-in subagent cards
  - Spec: `specs/live-subagent-usage-labels.md`
  - PR: https://github.com/asabya/nightmanager/pull/9
  - Scope: add compact inline usage labels to `finder`, `oracle`, `worker`, and `manager` cards using the shared transcript usage snapshot and Pi-native formatting.
  - Acceptance:
    - Each built-in subagent card shows a live compact label while running.
    - The label remains visible after completion, failure, or cancellation.
    - The label matches Pi-style usage formatting and does not introduce a new convention.
    - Rendering stays limited to built-in subagents only.
    - A small throttle/debounce prevents repaint spam.
  - Validation:
    - npm run typecheck
    - npm test
    - npm run build
  - Notes: likely files include `src/core/subagent-rendering.ts`, `src/tools/finder.ts`, `src/tools/oracle.ts`, `src/tools/worker.ts`, `src/tools/manager.ts`, and related tests.

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
