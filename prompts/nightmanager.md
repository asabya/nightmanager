# Nightmanager Cycle

Run exactly one Nightmanager cycle.

## Context

Read these files first when present:

1. `prompts/agents.md`
2. `prompts/agent-loop.md`
3. `TODOs.md`
4. relevant non-draft specs in `specs/`
5. `prompts/review-personas.md`
6. `README.md` and `package.json` as needed

## Instructions

1. Inspect `git status --porcelain`. Nightmanager requires a clean working tree at start; if any pre-existing uncommitted changes are present, stop without modifying anything and report that a clean tree is required. Do not stash, reset, or overwrite user changes.
2. Select exactly one eligible TODO from `TODOs.md`:
   - `[bug]` first
   - then `[ready]` by priority and smallest safe scope
   - `[ready]` TODOs must link a non-draft spec
   - `[bug]` TODOs may omit a linked spec; when they do, use `specs/TEMPLATE.md` as the Testing Plan source
   - ignore `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`
   - ignore specs whose basename starts with `draft-`
3. Derive a branch name from the selected TODO title before implementation:
   - sanitize the title into a valid branch slug; if it is empty, stop and report
   - do not add a `nightmanager/` prefix
   - if the branch exists locally or on `origin`, append `-2`, then `-3`, etc. until free
   - create and switch to the branch from the current branch as-is
4. Load the linked spec and relevant docs. For a `[bug]` TODO without a linked spec, load `specs/TEMPLATE.md` for the repository default Testing Plan and rely on the TODO for scope and acceptance.
5. Delegate implementation to the `manager` tool with a self-contained handoff containing:
   - selected TODO title and status
   - linked spec path
   - selected branch name
   - acceptance criteria
   - constraints and risks
   - Testing Plan source: the linked spec's `## Testing Plan`, or `specs/TEMPLATE.md` only for a `[bug]` TODO with no linked spec
   - explicit validation/manual-check commands from that Testing Plan, if any
   - requirement to complete exactly one TODO as one branch, one commit, and one PR when possible
6. Require tests/docs/validation appropriate to the TODO using the selected Testing Plan as the single source of truth. Do not infer or auto-detect validation commands at Nightmanager runtime. If the Testing Plan says no automated validation commands are configured, run no test/typecheck/build commands and report that limitation.
7. If validation fails, stop with implementation changes left uncommitted for human inspection. Do not commit, push, open a PR, stash, or reset.
8. Update `TODOs.md` to `[done]` when complete, recording the commit hash once available and the PR URL only if PR creation succeeds; use `[blocked]` with a concise reason when not safely implementable.
9. Commit exactly one completed TODO. Do not implement multiple TODOs in this run.
10. After the local commit succeeds, try to push the branch to `origin` and open a normal ready-for-review PR with `gh pr create`. Use PR title/body content from the TODO, linked spec, implementation summary, files changed, validation results, and commit hash. Do not merge the PR.
11. If push or PR creation fails after commit, keep the local commit and report `completed locally; PR fallback used` with the exact `git`/`gh` failure reason.
12. End with a concise report: selected TODO, branch name, commit hash or blocked reason, PR URL only if created, local-commit fallback reason when PR creation fails, files changed, validations run, and follow-ups.

Do not ask for live steering. If the TODO/spec is ambiguous or unsafe, block it with an explanation instead of guessing.
