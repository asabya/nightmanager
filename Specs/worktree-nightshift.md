# Night Shift Worktree Workflow

This spec defines an alternative Night Shift workflow that uses git worktrees, branch-per-TODO commits, and creates PRs with optional Codex review.

## Intent

The standard Night Shift workflow commits directly to `main`. This workflow provides:
- Isolation: each TODO gets its own worktree and branch
- Review readiness: PRs are created automatically for human review
- Codex integration: if available, requests code review from the Codex GitHub app

## Use Cases

- Teams that require PR review before merging
- Projects where direct main commits are not allowed
- Night Shift runs that should produce reviewable diffs

## Files

- `Specs/worktree-nightshift.md` — this spec
- `.pi/prompts/worktree-nightshift.md` — prompt template for worktree mode
- `scripts/worktree-nightshift.sh` — shell entrypoint

## Implementation

### 1. Worktree Management

The workflow uses git worktrees to isolate each TODO:

```bash
# Create a worktree for the feature branch
git worktree add -b feature/todo-<slug> ../.worktrees/<todo-slug> main

# Work on the TODO in the worktree
cd ../.worktrees/<todo-slug>

# After implementation and PR, remove worktree
git worktree remove ../.worktrees/<todo-slug>
```

Store worktree paths in `.worktrees/<slug>` for reference.

### 2. Branch Naming Convention

Branch name format: `<type>/todo-<slug>`

- `feature/todo-<slug>` — for `[ready]` items
- `bugfix/todo-<slug>` — for `[bug]` items
- `type` = `feature`, `bugfix`, `refactor`, `docs`

The `<slug>` is derived from the TODO title:
- lowercase, alphanumeric and hyphens only
- max 50 characters
- example: `[ready][P1] Add OAuth login` → `feature/todo-add-oauth-login`

### 3. Commit Behavior

Each TODO commits to its own branch:

1. Create worktree from `main`
2. Run implementation in worktree
3. Commit to feature branch (not main)
4. Push branch to origin

### 4. PR Creation

After successful implementation:

```bash
# Create PR with gh cli
gh pr create \
  --title "<TODO title>" \
  --body "<!-- Auto-generated --> \
TODO: <todo-title> \
Spec: <spec-path> \
\
Implementation: <commit-hash> \
\
Validations: \
- typecheck: <passed|failed> \
- test: <passed|failed> \
- build: <passed|failed> \
\
[TODO link](link)" \
  --base main \
  --head <branch-name>
```

### 5. Codex Review

If Codex is installed in the repository, request review:

```bash
# Check if Codex is available
gh api repos/{owner}/{repo}/installation -q '.app_slug' 2>/dev/null || echo "not-installed"
```

If Codex is available, add to PR reviewers or use `/codex review` command:

```bash
# Request Codex review (if supported by the app)
gh pr review-request add <pr-number> --repo-owner <owner> --team <team-name>
# Or use Codex bot command if supported
gh issue comment <pr-number> --body "/codex review"
```

Alternatively, label the PR to trigger Codex:

```bash
gh pr edit <pr-number> --add-label "codex-review"
```

### 6. TODO Status Update

Update TODOs.md with PR link:

```
### [in-progress][P1][feature] Add OAuth login

PR: https://github.com/asabya/subagents/pull/123

// ... rest of TODO
```

After merge, update to `[done]` with PR hash.

## Prompt Template

See `.pi/prompts/worktree-nightshift.md`.

## Validation Commands

Same as standard Night Shift:

```bash
npm run typecheck
npm test
npm run build
```

## Error Handling

- If worktree creation fails → report and stop
- If validation fails → do not create PR, update TODO to `[blocked]`
- If PR creation fails → push branch anyway, report manual PR creation needed
- If Codex review request fails → continue without it, note in report

## Workflow Summary

```
1. Select eligible TODO
2. Derive branch name from TODO slug
3. Create worktree: git worktree add -b <branch> ../.worktrees/<slug> main
4. Delegate to manager for implementation
5. Run validations
6. Commit to feature branch
7. Push to origin
8. Create PR: gh pr create
9. Request Codex review (if available)
10. Update TODOs.md with PR link
11. Report: TODO, PR URL, files changed, validations
```

## Comparison with Standard Night Shift

| Aspect | Standard | Worktree |
|--------|----------|----------|
| Branch | main | feature/todo-* |
| Commits | Direct to main | Feature branch |
| PR | None | Auto-created |
| Review | Manual | Optional Codex |
| Isolation | None | Full worktree |
| Cleanup | N/A | Remove worktree after merge |

## Integration

The worktree mode can be enabled via env var:

```bash
NIGHTSHIFT_MODE=worktree ./scripts/worktree-nightshift.sh
```

Default remains standard mode unless `NIGHTSHIFT_MODE=worktree` is set.