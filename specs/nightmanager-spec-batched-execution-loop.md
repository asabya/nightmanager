# Spec: Nightmanager spec-batched execution loop

Status: draft
Owner: <human>
Created: 2026-04-30

## Problem

Nightmanager currently executes one TODO at a time and the shell wrapper loads every non-draft spec into context. That makes the loop heavier than necessary and breaks the intended AFK flow where related TODOs stay on the same branch until the whole spec is complete.

We need a fresh, script-driven loop that keeps context small, groups work by exact `Spec:` path, and only moves to the next spec after the current one is finished.

## Goals

- Pick the first eligible TODO from `TODOs.md` using the existing priority order.
- Group all TODOs that reference the exact same `Spec:` path onto one branch.
- Keep every TODO for a spec on the same branch until that spec is complete.
- Allow `[bug]` TODOs without a linked spec to run as their own single-TODO branch.
- Keep the prompt/context minimal; do not preload every spec file.
- Commit each TODO separately, but create only one PR per spec.
- After a spec is complete and its PR is opened, return to the starting branch and continue with the next eligible spec.

## Non-Goals

- Do not change the repository’s TODO format.
- Do not create GitHub issues.
- Do not merge PRs automatically.
- Do not invent cross-spec batching rules.
- Do not mix TODOs from different specs in the same branch.

## Current Behavior

Relevant files:

- `scripts/nightmanager.sh` runs one Nightmanager cycle and currently adds every non-draft spec file to context.
- `scripts/worktree-nightmanager.sh` provides a separate worktree-oriented runner with similar broad context loading.
- `prompts/nightmanager.md` describes a single-TODO cycle.
- `prompts/agent-loop.md` describes Nightmanager as one TODO = one branch = one commit = one PR when possible.
- `TODOs.md` is the implementation queue and already groups work by exact `Spec:` path.

Today, Nightmanager does not batch by spec.

## Desired Behavior

A Nightmanager run should behave like a small outer loop around spec batches:

1. Read `TODOs.md` and select the first eligible TODO using the existing order:
   - `[bug]` first
   - then `[ready]`
2. Use that TODO’s exact `Spec:` path to define the active spec batch.
3. Keep working only on TODOs whose `Spec:` path matches that active spec.
4. Commit each TODO in that batch separately on the same branch.
5. Treat any `[bug]` without a `Spec:` as a standalone batch with one TODO and one branch.
6. Do not switch to a different spec until every TODO for the active spec is `[done]` or the batch is blocked.
7. When the active spec is complete, push the branch, open one PR, switch back to the starting branch, and continue with the next eligible spec.
8. Use a minimal prompt for the agent run; the wrapper script should do the batching and context selection, not a giant preloaded prompt bundle.

Branch naming rules:

- For spec-backed batches, derive the branch slug from the spec file basename.
- If the slug collides locally or on `origin`, append `-2`, then `-3`, etc.
- For bug-only batches with no spec, derive the slug from the TODO title.
- Do not add a `nightmanager/` prefix.

## Acceptance Criteria

- [ ] The first eligible TODO in `TODOs.md` selects the active spec batch.
- [ ] TODOs with the same exact `Spec:` path stay on the same branch.
- [ ] Nightmanager does not switch to a different spec while the active spec still has non-done TODOs.
- [ ] `[bug]` TODOs without a spec run as their own single-TODO batch.
- [ ] Branch names for spec batches come from the spec basename and handle local/origin collisions with numeric suffixes.
- [ ] The runner no longer preloads every spec file; it only loads the active spec and the small shared set of Nightmanager docs it actually needs.
- [ ] Each TODO still gets its own commit, and each spec gets one PR when complete.
- [ ] After one spec is finished, Nightmanager returns to the starting branch before starting the next spec batch.
- [ ] `TODOs.md` updates record commit hashes, and PR URLs only when a PR is created.

## Edge Cases

- A spec has eligible TODOs plus later `[draft]` or `[blocked]` TODOs: do not jump to another spec; pause that batch until the spec is fully ready or explicitly blocked.
- The chosen spec basename sanitizes to an empty branch slug: stop and report the problem.
- The starting branch is not `master`: return to whatever branch was checked out when the run began.
- A branch exists locally or on `origin`: keep incrementing the suffix until a free branch name is found.
- Validation fails on a TODO in the active spec: stop before moving on to another spec.
- PR creation fails after a completed spec: keep the local commits and report the fallback reason.

## Suggested Approach

- Move spec grouping into the shell/script layer so the prompt can stay small.
- Keep the agent prompt focused on the active TODO/spec batch rather than on repository-wide discovery.
- Load only the active spec file plus the shared Nightmanager instructions/docs needed for execution.
- Reuse the existing manager/finder/oracle/worker flow inside each TODO commit, but add outer orchestration for spec completion and branch switching.
- Consider a small helper for:
  - selecting the first eligible TODO,
  - collecting remaining TODOs for the same `Spec:`,
  - deriving a branch slug from the spec basename,
  - checking local and remote branch collisions.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Additional validation:

- Run a dry/manual cycle in a clean repo with multiple TODOs sharing one spec and confirm they stay on one branch.
- Confirm a second spec is not started until the first spec has no remaining non-done TODOs.
- Confirm branch collisions are resolved against both local refs and `origin`.
- Confirm the runner does not preload every spec file into context.
- Confirm a bug-only TODO without a spec gets a single-TODO branch and completes independently.
- Confirm the runner returns to the starting branch after a spec batch completes.

## Documentation Updates

- `scripts/nightmanager.sh`: replace the broad one-TODO runner with the spec-batched loop.
- `scripts/worktree-nightmanager.sh`: align or retire if it overlaps with the new loop.
- `prompts/nightmanager.md`: shrink to the minimal active-batch instructions.
- `prompts/agent-loop.md`: update the Nightmanager execution story to spec batching.
- `prompts/agents.md`: keep routing and eligibility rules aligned.
- `README.md`: only if the public workflow description changes.

## Risks / Open Questions

- Should a spec batch pause on `[draft]` / `[blocked]` TODOs, or skip them and continue later? The desired behavior here assumes pause.
- Should bug-only batches always use the TODO title for branch naming, or should they use a fixed `bug-` prefix? The current proposal uses the TODO title.
- Does the branch need to return specifically to `master`, or just to the branch checked out when the run began? This spec assumes the starting branch.
