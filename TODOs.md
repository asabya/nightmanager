# TODOs

Night Shift implementation queue.

## Status Tags

- `[bug]` — eligible; highest priority defect.
- `[ready]` — eligible for autonomous implementation.
- `[draft]` — not eligible; still being planned. Created by Day Shift planner or human. Human must promote to `[ready]` before Night Shift can pick it up.
- `[blocked]` — not eligible until the reason is resolved.
- `[in-progress]` — currently being worked.
- `[done]` — complete; include commit hash when available.

## Queue

Add one item per feature/bug. Prefer small, independently reviewable work.

### [done][P1][config] Streamline subagent model and thinking configuration (c0d)

Spec: `Specs/subagent-config-streamlining.md`

Acceptance criteria:

- [ ] Unified `~/.pi/agent/subagents.json` config supports per-agent `model` and `thinking`.
- [ ] Legacy per-agent config files are no longer used or documented.
- [ ] Manager and Finder can be configured with cheaper/smaller models.
- [ ] Worker and especially Oracle can be configured with higher-tier models.
- [ ] No docs or examples set `thinking` to `low`; use at least `medium`.
- [ ] An agent-friendly Markdown setup guide explains how to create/update the config after installation.
- [ ] README documents the new config format and recommended model split.
- [ ] Tests cover unified config parsing, fallback behavior, malformed config, invalid models, and per-agent resolution.
- [ ] Validations pass:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- Pi's `pi-agent-core` `Agent` type has `thinkingLevel`; apply per-agent `thinking` through that API.
- Preferred setup path is documentation-driven, not an installer script.


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

### [done][P2][workflow] Add a Day Shift planner workflow for better specs (8db81fd)


Spec: `Specs/day-shift-planner-agent.md`

Acceptance criteria:

- [x] A documented Day Shift planner workflow exists in repo docs.
- [x] Planner-created specs are written as `Specs/draft-*.md` by default.
- [x] Planner-created TODOs are `[draft]` by default.
- [x] The workflow includes a readiness checklist for promoting a draft to `[ready]`.
- [x] Documentation distinguishes Day Shift planner work from Night Shift manager implementation work.
- [x] At least one example prompt or prompt template is added for using the planner.

Validation:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- Implementation complete: AGENT_LOOP.md, docs/nightshift.md, .pi/prompts/day-planner.md, TODOs.md, Specs/README.md all updated.
- Do not add a dedicated fifth `planner` subagent in this TODO.

### [done][bug][P1][ui] Fix landing page dark theme not rendering correctly

Spec: `Specs/x-styled-landing.md`

Acceptance criteria:

- [done: 49df72ab] Dark theme CSS variables render correctly in all browsers
- [done: 49df72ab] Background uses dark color (#1a1a1a or similar), not white
- [ ] Text is visible (near-white on dark background)
- [ ] OKLCH colors have proper fallback for browsers that don't support them
- [ ] No white flash on page load

Validation:

```bash
# Verify page renders with dark background in browser
# No white background visible
```

Notes:

- Bug: landing page shows white background making text invisible
- Likely cause: OKLCH CSS custom properties not falling back correctly, or `:root` variables not applying

### [done][P2][ui] Style landing page with X aesthetics (9aa986a)

Spec: `Specs/x-styled-landing.md`

Acceptance criteria:

- [ ] A static HTML landing page exists at `landing/index.html`
- [ ] Design follows X dark theme aesthetic
- [ ] CSS variables use OKLCH color system with dark background (#1a1a1a equivalent)
- [ ] Typography uses Inter font family
- [ ] Landing page includes: header, hero, features section, tool cards, CTA, footer
- [ ] Smooth scroll and subtle fade-in animations
- [ ] Responsive design for mobile/desktop
- [ ] Links back to existing documentation work

Validation:

```bash
# Verify HTML is well-formed
# No validation errors in browser console
```

Notes:


- Design inspired by X landing page
- Color scheme: dark charcoal background with near-white text
- Font: Inter (body), Cal Sans or similar for display headings
- Create static HTML, not dynamic Pi-generated
- Keep existing Pi subagent tools unchanged
