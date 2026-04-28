# Spec: Rebrand "subagents" to "The Nightmanager"

Status: draft
Owner: human
Created: 2026-04-27

## Problem

The project is named "Subagents" but the product is "The Nightmanager" — a Nightmanager workflow orchestrator. The name doesn't reflect the actual value proposition.

## Goals

- Rename npm package to `nightmanager`
- Rename "Night Shift" workflow to "Nightmanager" workflow
- Update all product references from "subagents" to "nightmanager"
- Rename scripts and prompts from `nightshift` to `nightmanager`
- Rebrand landing page with new product name and updated marketing copy
- Ensure all docs, prompts, and scripts reflect the new name

## Non-Goals

- **No logo creation** — excluded from scope
- **No visual identity work** — only text changes on landing page
- **No version bump** — not published yet
- **Subagent tool names remain unchanged** — manager, finder, oracle, worker keep their names
- **GitHub repo rename** — user will handle manually after spec is complete

## Current Behavior

Package is named `subagents`, used as:
- npm package name
- "Night Shift" workflow name in docs and prompts
- Landing page title: "Subagents for Pi"
- Scripts named `nightshift.sh`, `worktree-nightshift.sh`
- Prompt templates named `nightshift.md`, etc.

## Desired Behavior

Package renamed to `nightmanager`:
- npm package: `nightmanager`
- Workflow name: "Nightmanager" (replaces "Night Shift")
- Landing page title: "The Nightmanager"
- References updated: "nightmanager config", "nightmanager package"
- Scripts renamed: `nightmanager.sh`, `worktree-nightmanager.sh`
- Prompts renamed: `nightmanager.md`, etc.

Landing page marketing copy should:
- Position nightmanager as the autonomous Nightmanager orchestrator
- Highlight that it's a multi-specialist team (Finder, Oracle, Worker, Manager)
- Explain the Nightmanager workflow as the core value proposition
- Include CTAs linking to docs and GitHub

## Files to Change

### Package Config
- `package.json`: name → `nightmanager`, keywords, description

### Landing Page
- `landing/index.html`: title, meta description, hero copy, all internal links

### Documentation
- `docs/index.md`
- `docs/nightshift.md`
- `docs/subagent-config-setup.md`

### Project Meta
- `AGENTS.md`
- `AGENT_LOOP.md`
- `TODOs.md`

### Specs
- `Specs/file-based-handoffs.md`
- `Specs/worktree-nightshift.md`
- `Specs/subagent-config-streamlining.md`
- `Specs/day-shift-planner-agent.md`
- `Specs/x-styled-landing.md`

### Prompts
- `.pi/prompts/nightshift.md`
- `.pi/prompts/day-planner.md`
- `.pi/prompts/worktree-nightshift.md`

### Scripts
- `scripts/nightshift.sh`
- `scripts/worktree-nightshift.sh`

## Acceptance Criteria

- [ ] `package.json` name changed to `nightmanager`
- [ ] "Night Shift" → "Nightmanager" workflow name updated throughout
- [ ] Scripts renamed: `nightshift.sh` → `nightmanager.sh`, etc.
- [ ] Prompts renamed: `nightshift.md` → `nightmanager.md`, etc.
- [ ] Landing page title changed to "The Nightmanager"
- [ ] Landing page hero copy positions nightmanager as Nightmanager orchestrator
- [ ] "Nightmanager" workflow name used throughout (replaces "Night Shift")
- [ ] Subagent tool names (manager, finder, oracle, worker) unchanged

## Edge Cases

- GitHub repo name is separate from code — user must rename repo manually after code changes
- External links (blog posts, tutorials) not in this repo — not in scope
- `node_modules` references — ignored (npm will regenerate)
- `.pi/nightmanager/sessions/` log files — ignored

## Suggested Approach

1. `Night Shift` → `Nightmanager` (workflow name)
2. `nightshift` → `nightmanager` (script/prompt file names and references)
3. `subagents` → `nightmanager` (package/product name)
4. `Subagents` → `The Nightmanager` (display name)
5. Update `asabya/subagents` → `asabya/nightmanager` in URLs

File renames:
- `scripts/nightshift.sh` → `scripts/nightmanager.sh`
- `scripts/worktree-nightshift.sh` → `scripts/worktree-nightmanager.sh`
- `.pi/prompts/nightshift.md` → `.pi/prompts/nightmanager.md`
- `.pi/prompts/worktree-nightshift.md` → `.pi/prompts/worktree-nightmanager.md`

Use search-and-replace with case handling to avoid breaking code identifiers.

## Testing Plan

```bash
npm run typecheck
npm test
npm run build
```

All existing tests should pass — no logic changes.

## Documentation Updates

No new documentation needed. All existing docs are updated as part of the rebrand.

## Risks / Open Questions

- **GitHub repo rename**: User must rename `asabya/subagents` → `asabya/nightmanager` separately
- **Deployed landing page**: If `asabya.github.io/subagents` is deployed, user needs to redeploy with new content
- **External references**: Blog posts, tutorials, etc. outside this repo are not updated