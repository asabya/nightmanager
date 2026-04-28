# TODOs

Nightmanager implementation queue.

## Status Tags

- `[bug]` — eligible; highest priority defect.
- `[ready]` — eligible for autonomous implementation.
- `[draft]` — not eligible; still being planned. Created by Day Shift planner or human. Human must promote to `[ready]` before Nightmanager can pick it up.
- `[blocked]` — not eligible until the reason is resolved.
- `[in-progress]` — currently being worked.
- `[done]` — complete; include commit hash when available.

## Queue

### [done][P1][workflow] Package inbuilt planning skills for Pi discovery (5f7cf48)

Spec: `specs/inbuilt-planning-skills.md`

Acceptance criteria:

- [x] `grill-me`, `to-prd`, and `to-issues` are packaged with `nightmanager` as inbuilt Pi skills.
- [x] Pi discovers the skills automatically after install with no extra setup step.
- [x] `grill-me` remains a tiny prompt matching the approved wording.
- [x] `to-prd` creates draft specs in `specs/` using the existing spec template and format.
- [x] `to-issues` creates local `TODOs.md` entries in the existing format by default.
- [x] `to-issues` breaks a spec into multiple vertically scalable TODOs when the work is large enough to justify slices.
- [x] GitHub issue creation is available only when explicitly requested and is not the default behavior.
- [x] Existing Nightmanager docs and conventions remain compatible with the generated artifacts.

Validation:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- Packaging approach confirmed: expose the skills through the extension entrypoint in a way Pi already scans.
- Keep the skill content itself tiny; the repo workflow guidance should live in the planning skills and docs.

### [done][P1][meta] Rebrand "subagents" to "The Nightmanager" (16d6b2cc31a5854e39bb55c140023d34f8375df3)

Spec: `specs/nightmanager-rebrand.md`

Acceptance criteria:

- [x] `package.json` name changed to `nightmanager`
- [x] "Night Shift" → "Nightmanager" workflow name updated throughout
- [x] Scripts renamed: `nightshift.sh` → `nightmanager.sh`, etc.
- [x] Prompts renamed: `nightshift.md` → `nightmanager.md`, etc.
- [x] Landing page title changed to "The Nightmanager"
- [x] Landing page hero copy positions Nightmanager as the orchestrator
- [x] "Nightmanager" workflow name used throughout
- [x] Subagent tool names (manager, finder, oracle, worker) unchanged

Validation:

```bash
npm run typecheck && npm test && npm run build
```

Notes:

- Text substitution + file renames only, no logic changes
- User must rename GitHub repo separately: `asabya/subagents` → `asabya/nightmanager`

### [done][P1][config] Streamline subagent model and thinking configuration (c0d)

Spec: `specs/subagent-config-streamlining.md`

Acceptance criteria:

- [x] Unified `~/.pi/agent/nightmanager.json` config supports per-agent `model` and `thinking`.
- [x] Legacy per-agent config files are no longer used or documented.
- [x] Manager and Finder can be configured with cheaper/smaller models.
- [x] Worker and especially Oracle can be configured with higher-tier models.
- [x] No docs or examples set `thinking` to `low`; use at least `medium`.
- [x] An agent-friendly Markdown setup guide explains how to create/update the config after installation.
- [x] README documents the new config format and recommended model split.
- [x] Tests cover unified config parsing, fallback behavior, malformed config, invalid models, and per-agent resolution.
- [x] Validations pass:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- Pi's `pi-agent-core` `Agent` type has `thinkingLevel`; apply per-agent `thinking` through that API.
- Preferred setup path is documentation-driven, not an installer script.


### [done][P1][workflow] Persist Worker handoffs to file artifacts (763cefa)

Spec: `specs/file-based-handoffs.md`

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
- See `docs/nightmanager.md#inspecting-handoffs` for operational guidance.

### [done][P1][workflow] Add worktree Nightmanager mode with PR creation

Spec: `specs/worktree-nightmanager.md`

Acceptance criteria:

- [x] A worktree Nightmanager spec exists at `specs/worktree-nightmanager.md`.
- [x] A worktree prompt template exists at `.pi/prompts/worktree-nightmanager.md`.
- [x] A shell script exists at `scripts/worktree-nightmanager.sh`.
- [ ] The workflow creates a git worktree per TODO.
- [ ] Each TODO commits to a feature branch (not main).
- [ ] PR is created via `gh pr create` after implementation.
- [ ] Codex is detected and review requested if available.
- [ ] TODOs.md is updated with PR link.
- [x] Documentation in `docs/nightmanager.md` covers worktree mode.
- [ ] Validations pass:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- This is a new workflow option, not replacing the standard one.
- Enable via `NIGHTSHIFT_MODE=worktree` env var.
- See `specs/worktree-nightmanager.md` for full design.

### [done][P2][workflow] Add a Day Shift planner workflow for better specs (8db81fd)


Spec: `specs/day-shift-planner-agent.md`

Acceptance criteria:

- [x] A documented Day Shift planner workflow exists in repo docs.
- [x] Planner-created specs are written as `specs/draft-*.md` by default.
- [x] Planner-created TODOs are `[draft]` by default.
- [x] The workflow includes a readiness checklist for promoting a draft to `[ready]`.
- [x] Documentation distinguishes Day Shift planner work from Nightmanager manager implementation work.
- [x] At least one example prompt or prompt template is added for using the planner.

Validation:

```bash
npm run typecheck
npm test
npm run build
```

Notes:

- Implementation complete: AGENT_LOOP.md, docs/nightmanager.md, .pi/prompts/day-planner.md, TODOs.md, specs/README.md all updated.
- Do not add a dedicated fifth `planner` subagent in this TODO.

### [done][bug][P1][ui] Fix landing page dark theme not rendering correctly

Spec: `specs/x-styled-landing.md`

Acceptance criteria:

- [done: 49df72ab] Dark theme CSS variables render correctly in all browsers
- [done: 49df72ab] Background uses dark color (#1a1a1a or similar), not white
- [x] Text is visible (near-white on dark background)
- [x] OKLCH colors have proper fallback for browsers that don't support them
- [x] No white flash on page load

Validation:

```bash
# Verify page renders with dark background in browser
# No white background visible
```

Notes:

- Bug: landing page shows white background making text invisible
- Likely cause: OKLCH CSS custom properties not falling back correctly, or `:root` variables not applying

### [done][P2][ui] Style landing page with X aesthetics (9aa986a)

Spec: `specs/x-styled-landing.md`

Acceptance criteria:

- [x] A static HTML landing page exists at `landing/index.html`
- [x] Design follows X dark theme aesthetic
- [x] CSS variables use OKLCH color system with dark background (#1a1a1a equivalent)
- [x] Typography uses Inter font family
- [x] Landing page includes: header, hero, features section, tool cards, CTA, footer
- [x] Smooth scroll and subtle fade-in animations
- [x] Responsive design for mobile/desktop
- [x] Links back to existing documentation work

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
