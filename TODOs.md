# TODOs

Night Shift implementation queue.

## Status Tags

- `[bug]` — eligible; highest priority defect.
- `[ready]` — eligible for autonomous implementation.
- `[draft]` — not eligible; still being planned.
- `[blocked]` — not eligible until the reason is resolved.
- `[in-progress]` — currently being worked.
- `[done]` — complete; include commit hash when available.

## Queue

Add one item per feature/bug. Prefer small, independently reviewable work.

### [done][P1][workflow] Persist Worker handoffs to file artifacts (763cefa)

Spec: `Specs/file-based-handoffs.md`

Acceptance criteria:

- [x] Invoking Worker with a non-empty handoff writes a JSON handoff artifact to a local file.
- [x] The artifact includes objective, findings, target files, decisions, constraints, risks, verification guidance, evidence, raw context when provided, creation time, version, and source metadata.
- [x] The Worker task text references the handoff artifact path and instructs Worker to read/use it.
- [x] Existing direct Worker calls without handoff continue to work.
- [x] Manager's `handoff_to_worker` path produces a handoff artifact before Worker execution.
- [x] Handoff artifact directory is ignored by git.
- [x] Tests cover artifact creation, task/path inclusion, and backwards compatibility for no-handoff Worker execution.
- [x] Documentation explains where handoff files are written and how humans can inspect them to verify handoffs are working.

Validation:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- File-based handoffs were already implemented in prior work. This commit adds missing documentation to README.md.
- Handoff artifacts stored at `~/.pi/handoffs/<timestamp>-worker-handoff.json`
- See `docs/nightshift.md#inspecting-handoffs` for operational guidance.

### [done][P1][workflow] Add worktree Night Shift mode with PR creation

Spec: `Specs/worktree-nightshift.md`

Acceptance criteria:

- [ ] A worktree Night Shift spec exists at `Specs/worktree-nightshift.md`.
- [ ] A worktree prompt template exists at `.pi/prompts/worktree-nightshift.md`.
- [ ] A shell script exists at `scripts/worktree-nightshift.sh`.
- [ ] The workflow creates a git worktree per TODO.
- [ ] Each TODO commits to a feature branch (not main).
- [ ] PR is created via `gh pr create` after implementation.
- [ ] Codex is detected and review requested if available.
- [ ] TODOs.md is updated with PR link.
- [ ] Documentation in `docs/nightshift.md` covers worktree mode.
- [ ] Validations pass:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- This is a new workflow option, not replacing the standard one.
- Enable via `NIGHTSHIFT_MODE=worktree` env var.
- See `Specs/worktree-nightshift.md` for full design.

### [ready][P2][workflow] Add a Day Shift planner workflow for better specs

Spec: `Specs/day-shift-planner-agent.md`

Acceptance criteria:

- [ ] A documented Day Shift planner workflow exists in repo docs.
- [ ] Planner-created specs are written as `Specs/draft-*.md` by default.
- [ ] Planner-created TODOs are `[draft]` by default.
- [ ] The workflow includes a readiness checklist for promoting a draft to `[ready]`.
- [ ] Documentation distinguishes Day Shift planner work from Night Shift manager implementation work.
- [ ] At least one example prompt or prompt template is added for using the planner.

Validation:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- Implement the documentation/prompt workflow first.
- Do not add a dedicated fifth `planner` subagent in this TODO.
