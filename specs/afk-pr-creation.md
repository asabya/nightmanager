# Spec: AFK PR creation for Nightmanager cycles

Status: ready
Owner: human
Created: 2026-04-29

## Problem

Nightmanager currently supports autonomous local implementation, validation, TODO updates, and commits, but the desired launch positioning promises that a solo developer can stop babysitting agents and come back to reviewable PRs. That promise is not accurate until the Nightmanager cycle can create a branch, push it, and open a GitHub PR automatically after completing exactly one eligible TODO.

## Goals

- Extend the existing `/nightmanager` cycle so one eligible TODO becomes one branch, one local commit, and one ready-for-review GitHub PR when possible.
- Keep the existing local-first safety guarantees: clean working tree before start, one TODO per run, tests before commit, no guessing on ambiguous specs.
- Use the user's existing GitHub CLI (`gh`) authentication and `origin` remote.
- Fall back to the existing local commit report when PR creation is not possible after a successful commit.
- Make PR title/body useful by deriving them from the TODO, linked spec, implementation summary, and validation results.

## Non-Goals

- Do not add Nightmanager-managed GitHub tokens or OAuth flows.
- Do not merge PRs automatically.
- Do not create draft PRs by default.
- Do not create GitHub issues as part of this flow.
- Do not implement multi-TODO PRs or multi-commit batching.
- Do not auto-stash or reset user changes.

## Current Behavior

Relevant current files:

- `prompts/nightmanager.md` defines the Nightmanager cycle. It selects one eligible TODO, delegates implementation to `manager`, updates `TODOs.md`, commits exactly one completed TODO, and reports the result.
- `prompts/agent-loop.md` describes the Day Shift / Nightmanager workflow and currently frames Nightmanager execution as local commit/report output.
- `prompts/agents.md` routes autonomous work through `manager` and preserves one-TODO commit discipline.
- `TODOs.md` supports `[done]` entries with commit hash.
- `src/tools/manager.ts` delegates implementation to Worker through structured handoff.
- `src/tools/worker.ts` performs local edits and validation via isolated subagent tools.

There is no explicit PR creation step today.

## Desired Behavior

A Nightmanager cycle should:

1. Start only when `git status` is clean.
   - If there are pre-existing uncommitted changes, stop and report that Nightmanager requires a clean working tree.
   - Do not stash, reset, or otherwise modify pre-existing user changes.
2. Select exactly one eligible TODO as today.
3. Derive a branch name from the selected TODO title.
   - Sanitize the TODO title into a valid branch slug.
   - Do not add a `nightmanager/` prefix.
   - If the branch exists locally or remotely on `origin`, append `-2`, then `-3`, etc. until a free branch name is found.
4. Create and switch to the TODO branch before implementation begins.
   - Branch from the current branch as-is.
5. Run the existing implementation loop through `manager`.
6. Run required validation.
   - If validation fails and implementation changes are uncommitted, stop and report the failure.
   - Leave failed implementation changes in place for human inspection.
   - Do not commit, push, open a PR, stash, or reset.
7. On successful validation, update `TODOs.md` to `[done]` immediately and commit exactly one completed TODO.
8. Try to push the branch to `origin` and open a normal ready-for-review GitHub PR using `gh`.
   - Use `origin` only.
   - Assume the user has `gh` installed and authenticated.
   - If `gh` is missing, unauthenticated, or the repo/remote cannot create a PR, fall back to a local commit report.
9. Generate the PR title and body from:
   - TODO title and status,
   - linked spec path,
   - acceptance criteria / implementation summary,
   - files changed,
   - validation commands and results,
   - commit hash.
10. Do not merge the PR.
11. Final report should include:
   - selected TODO,
   - branch name,
   - commit hash,
   - PR URL when created,
   - files changed,
   - validations run,
   - fallback reason if PR creation failed.

If PR creation fails after the local commit, the final report should clearly say `completed locally; PR fallback used` and include the exact `git`/`gh` failure reason. `TODOs.md` should contain the commit hash and include the PR URL only when available.

## Acceptance Criteria

- [ ] `prompts/nightmanager.md` describes branch creation before implementation, clean-tree precondition, PR creation after commit, and PR fallback behavior.
- [ ] `prompts/agent-loop.md` reflects the one TODO = one branch = one commit = one PR execution model.
- [ ] The workflow stops without modifying anything when the run starts with pre-existing uncommitted changes.
- [ ] Branch names are derived from TODO titles, have no `nightmanager/` prefix, and receive `-2` / `-3` suffixes on local or `origin` collisions.
- [ ] A successful run commits exactly one TODO and attempts to push/open a ready-for-review PR through `gh`.
- [ ] PR title/body include TODO/spec context, implementation summary, changed files, validation evidence, and commit hash.
- [ ] Missing/broken `gh`, failed auth, or unsuitable GitHub remote does not undo the local commit; it produces a local commit report with the exact fallback reason.
- [ ] Failed validation leaves implementation changes uncommitted for human inspection and does not push/open a PR.

## Edge Cases

- Selected TODO title sanitizes to an empty slug: stop and report that a valid branch name cannot be derived.
- Current branch is not the default branch: branch from the current branch anyway.
- `origin` is missing or not pushable: keep local commit and report PR fallback.
- Remote branch name collision exists on `origin` even if no local branch exists: append suffix.
- Commit succeeds but push fails: keep local commit and report PR fallback.
- Push succeeds but `gh pr create` fails: keep pushed branch/local commit and report PR fallback with the error.
- Validation command is unavailable or inappropriate for the repo: follow existing Nightmanager behavior and report the validation limitation.

## Suggested Approach

- Update prompt-level workflow first (`prompts/nightmanager.md`, `prompts/agent-loop.md`, possibly `prompts/agents.md`) because the Nightmanager cycle currently lives as a prompt-driven operating procedure.
- If needed, add helper scripts later for branch-name generation and PR creation, but keep the first implementation simple and auditable.
- Use commands equivalent to:
  - `git status --porcelain`
  - `git switch -c <todo-slug>`
  - `git ls-remote --heads origin <branch>` for remote collision checks
  - `git push -u origin <branch>`
  - `gh pr create --title <title> --body <body>`
- Keep the failure boundary clear: before commit, failures stop with local uncommitted changes; after commit, PR failures fall back to local commit reporting.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Additional validation:

- Run a dry/manual cycle in a test repository with a clean tree and authenticated `gh`.
- Test branch collision behavior with existing local and remote branch names.
- Test missing/unauthenticated `gh` and confirm local commit fallback report.
- Test pre-existing uncommitted changes and confirm Nightmanager stops before branching.
- Test validation failure and confirm changes remain uncommitted with no push/PR.

## Documentation Updates

- `README.md`: update Nightmanager outcome from local delegation/commits to AFK PR creation where appropriate.
- `docs/index.html`: update landing page copy to avoid under-selling the loop.
- `prompts/nightmanager.md`: primary source of truth for the cycle.
- `prompts/agent-loop.md`: update Day Shift / Nightmanager execution description.
- `prompts/agents.md`: update autonomous work routing expectations if needed.

## Risks / Open Questions

- How much PR creation should live in prompts versus a dedicated tool/script?
- Exact TODO `[done]` line format for storing both commit hash and PR URL needs to be standardized.
- GitHub repositories with protected branch policies may still allow PR creation but fail checks later; Nightmanager should not merge.
