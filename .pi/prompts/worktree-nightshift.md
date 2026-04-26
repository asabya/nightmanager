Read `AGENTS.md`, `AGENT_LOOP.md`, `TODOs.md`, and `Specs/worktree-nightshift.md`.

Run exactly one Night Shift cycle in worktree mode:

1. Select one eligible TODO (`[bug]` first, then `[ready]`). Ignore `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`.
2. Derive a branch name from the TODO: `feature/todo-<slug>` or `bugfix/todo-<slug>` (lowercase, hyphens, max 50 chars).
3. Create a git worktree for the branch:
   ```bash
   git worktree add -b <branch-name> ../.worktrees/<slug> main
   ```
4. In the worktree, load the linked spec and relevant docs.
5. Delegate implementation to `manager` with a self-contained handoff.
6. Run validations:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
7. Commit the completed TODO to the feature branch (not main).
8. Push the branch to origin:
   ```bash
   git push -u origin <branch-name>
   ```
9. Create a PR:
   ```bash
   gh pr create --title "<TODO>" --body "TODO: <link>" --base main --head <branch-name>
   ```
10. If Codex is available in repo apps, request review:
    ```bash
    # Check: gh api repos/{owner}/{repo}/installation
    # If available, use gh pr review-request or label
    ```
11. Update `TODOs.md` with PR link and status `[in-progress]`.
12. Report: TODO, PR URL, branch, commit, files changed, validations, Codex status.

If any step fails, clean up the worktree and report the block reason. Do not commit to main or merge in this workflow.