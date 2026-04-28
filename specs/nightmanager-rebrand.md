# Spec: Rebrand "nightmanager" to "The Nightmanager"

Status: draft
Owner: human
Created: 2026-04-27

## Problem

The project is named "The Nightmanager" but the product is "The Nightmanager" — a Nightmanager workflow orchestrator. The name doesn't reflect the actual value proposition.

## Goals

- Rename npm package to `nightmanager`
- Rename "Nightmanager" workflow to "Nightmanager" workflow
- Update all product references from "nightmanager" to "nightmanager"
- Rename scripts and prompts from `nightmanager` to `nightmanager`
- Rebrand landing page with new product name and updated marketing copy
- Ensure all docs, prompts, and scripts reflect the new name

## Non-Goals

- **No logo creation** — excluded from scope
- **No visual identity work** — only text changes on landing page
- **No version bump** — not published yet
- **Subagent tool names remain unchanged** — manager, finder, oracle, worker keep their names
- **GitHub repo rename** — user will handle manually after spec is complete

## Current Behavior

Package is named `nightmanager`, used as:
- npm package name
- "Nightmanager" workflow name in docs and prompts
- Landing page title: "The Nightmanager for Pi"
- Scripts named `nightmanager.sh`, `worktree-nightmanager.sh`
- Prompt templates named `nightmanager.md`, etc.

## Desired Behavior

Package renamed to `nightmanager`:
- npm package: `nightmanager`
- Workflow name: "Nightmanager" (replaces "Nightmanager")
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
- `docs/nightmanager.md`
- `docs/subagent-config-setup.md`

### Project Meta
- `AGENTS.md`
- `AGENT_LOOP.md`
- `TODOs.md`

### specs
- `specs/file-based-handoffs.md`
- `specs/worktree-nightmanager.md`
- `specs/subagent-config-streamlining.md`
- `specs/day-shift-planner-agent.md`
- `specs/x-styled-landing.md`

### Prompts
- `.pi/prompts/nightmanager.md`
- `.pi/prompts/day-planner.md`
- `.pi/prompts/worktree-nightmanager.md`

### Scripts
- `scripts/nightmanager.sh`
- `scripts/worktree-nightmanager.sh`

## Acceptance Criteria

- [ ] `package.json` name changed to `nightmanager`
- [ ] "Nightmanager" → "Nightmanager" workflow name updated throughout
- [ ] Scripts renamed: `nightmanager.sh` → `nightmanager.sh`, etc.
- [ ] Prompts renamed: `nightmanager.md` → `nightmanager.md`, etc.
- [ ] Landing page title changed to "The Nightmanager"
- [ ] Landing page hero copy positions nightmanager as Nightmanager orchestrator
- [ ] "Nightmanager" workflow name used throughout (replaces "Nightmanager")
- [ ] Subagent tool names (manager, finder, oracle, worker) unchanged

## Edge Cases

- GitHub repo name is separate from code — user must rename repo manually after code changes
- External links (blog posts, tutorials) not in this repo — not in scope
- `node_modules` references — ignored (npm will regenerate)
- `.pi/nightmanager/sessions/` log files — ignored

## Suggested Approach

1. `Nightmanager` → `Nightmanager` (workflow name)
2. `nightmanager` → `nightmanager` (script/prompt file names and references)
3. `nightmanager` → `nightmanager` (package/product name)
4. `The Nightmanager` → `The Nightmanager` (display name)
5. Update `asabya/nightmanager` → `asabya/nightmanager` in URLs

File renames:
- `scripts/nightmanager.sh` → `scripts/nightmanager.sh`
- `scripts/worktree-nightmanager.sh` → `scripts/worktree-nightmanager.sh`
- `.pi/prompts/nightmanager.md` → `.pi/prompts/nightmanager.md`
- `.pi/prompts/worktree-nightmanager.md` → `.pi/prompts/worktree-nightmanager.md`

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

- **GitHub repo rename**: User must rename `asabya/nightmanager` → `asabya/nightmanager` separately
- **Deployed landing page**: If `asabya.github.io/nightmanager` is deployed, user needs to redeploy with new content
- **External references**: Blog posts, tutorials, etc. outside this repo are not updated