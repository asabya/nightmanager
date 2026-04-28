# Nightmanager Setup

This project includes a Pi/nightmanager Nightmanager workflow.

- `AGENTS.md` — project router for agents.
- `AGENT_LOOP.md` — Day Shift and Nightmanager operating procedure.
- `TODOs.md` — queue of eligible work.
- `Specs/` — human-authored specs. `draft-*` specs are ignored.
- `REVIEW_PERSONAS.md` — review lenses for manager/nightmanager.
- `.pi/prompts/nightmanager.md` — non-interactive prompt used by the runner.
- `scripts/nightmanager.sh` — cron/launchd entrypoint.

## Day Shift Planner

The Day Shift planner is an optional workflow for brainstorming and organizing rough ideas into Nightmanager-ready specs.

### Purpose

- Help humans clarify underspecified ideas
- Identify missing requirements, edge cases, risks
- Produce draft specs (`Specs/draft-*.md`) for human review
- Keep draft TODOs as `[draft]` until the human approves

### Prompt Template

Use `.pi/prompts/day-planner.md` as a reusable prompt template. Key rules:

- Planner output is **advisory** — human must approve before work becomes `[ready]`
- Create specs as `Specs/draft-*.md` by default (Nightmanager ignores them)
- Add TODOs as `[draft]` only when requested
- Include a readiness checklist in the draft spec
- Do not implement code — leave that to Nightmanager

### Workflow

1. Human uses the planner prompt (directly or via Pi) to brainstorm an idea
2. Planner produces `Specs/draft-*.md` with acceptance criteria, edge cases, etc.
3. Human reviews the draft spec and confirms all checklist items
4. Human renames the spec (removes `draft-`) and/or changes TODO to `[ready]`
5. Nightmanager can now pick up the spec/TODO for implementation

### Nightmanager Ignoring Drafts

Nightmanager deliberately ignores `draft-*` specs and `[draft]` TODOs:

- Specs with filename starting with `draft-` are skipped
- TODOs tagged `[draft]` are skipped
- This ensures human approval is required before autonomous work begins

## Manual Run

From the repository root:

```bash
./scripts/nightmanager.sh
```

Optional environment variables:

```bash
NIGHTSHIFT_MODEL=anthropic/claude-sonnet-4-5 \
NIGHTSHIFT_THINKING=high \
./scripts/nightmanager.sh
```

If cron/launchd cannot find `pi`, set an absolute path:

```bash
PI_BIN=/Users/<you>/.nvm/versions/node/<version>/bin/pi ./scripts/nightmanager.sh
```

If running this workflow from another repository, point at the built nightmanager extension:

```bash
SUBAGENTS_EXTENSION=/path/to/nightmanager/dist/index.js ./scripts/nightmanager.sh
```

## Cron Example

Edit your crontab:

```bash
crontab -e
```

Run every weekday at 1:00 AM:

```cron
0 1 * * 1-5 cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager && mkdir -p .pi/nightmanager && PI_BIN=/Users/sabyasachipatra/.nvm/versions/node/v24.13.0/bin/pi ./scripts/nightmanager.sh >> .pi/nightmanager/cron.log 2>&1
```

The `mkdir -p` is intentional: shell redirection opens `.pi/nightmanager/cron.log` before `scripts/nightmanager.sh` can create its own log directories.

## macOS launchd Example

Create the log directory first because `launchd` will not create the parent directories for `StandardOutPath` or `StandardErrorPath`:

```bash
mkdir -p /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager/.pi/nightmanager
```

Create `~/Library/LaunchAgents/dev.asabya.nightmanager-nightmanager.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>dev.asabya.nightmanager-nightmanager</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager && PI_BIN=/Users/sabyasachipatra/.nvm/versions/node/v24.13.0/bin/pi ./scripts/nightmanager.sh</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>1</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>/Users/sabyasachipatra/go/src/github.com/asabya/nightmanager/.pi/nightmanager/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/sabyasachipatra/go/src/github.com/asabya/nightmanager/.pi/nightmanager/launchd.err.log</string>
</dict>
</plist>
```

Load it:

```bash
mkdir -p /Users/sabyasachipatra/go/src/github.com/asabya/nightmanager/.pi/nightmanager
launchctl load ~/Library/LaunchAgents/dev.asabya.nightmanager-nightmanager.plist
```

Unload it:

```bash
launchctl unload ~/Library/LaunchAgents/dev.asabya.nightmanager-nightmanager.plist
```

## Safety Notes

- Keep TODOs small and independently reviewable.
- Use `[draft]` and `draft-*` liberally. Only mark work `[ready]` when the spec is good.
- The runner has write and bash access. Run it only in repositories where autonomous commits are acceptable.
- The runner uses a lock directory to prevent overlapping runs.
- Logs and sessions are written under `.pi/nightmanager/` and ignored by git.

## Inspecting Handoffs

When Worker is called with handoff context (via Manager's `handoff_to_worker` or direct worker call with handoff data), a JSON handoff artifact is written to `.pi/handoffs/`. Each artifact includes:

- `version` — schema version
- `createdAt` — ISO timestamp
- `source` — "manager" or "direct-worker"
- `objective` — implementation goal
- `taskPreview` — truncated task description
- `handoff` — full structured handoff (findings, target files, decisions, constraints, risks, verification, evidence, raw context)

To inspect a handoff:

```bash
# List recent handoffs
ls -la ~/.pi/handoffs/

# View a specific handoff
cat ~/.pi/handoffs/<timestamp>-worker-handoff.json
```

Handoff artifacts are gitignored (`.pi/handoffs/`). They are retained indefinitely for auditability. Delete manually if cleanup is needed.

## Worktree Mode

An alternative workflow creates a git worktree per TODO, commits to a feature branch, and creates a PR:

```bash
NIGHTSHIFT_MODE=worktree ./scripts/worktree-nightmanager.sh
```

### How It Works

1. Select eligible TODO
2. Create worktree: `git worktree add -b feature/todo-<slug> ../.worktrees/<slug> main`
3. Run implementation in worktree
4. Commit to feature branch (not main)
5. Push branch to origin
6. Create PR: `gh pr create`
7. Request Codex review if available
8. Update TODOs.md with PR link

### Files

- `Specs/worktree-nightmanager.md` — workflow specification
- `.pi/prompts/worktree-nightmanager.md` — prompt template
- `scripts/worktree-nightmanager.sh` — entrypoint

### Branch Naming

- `feature/todo-<slug>` — for `[ready]` items
- `bugfix/todo-<slug>` — for `[bug]` items

### Codex Review

If Codex is installed in the repository, the workflow detects it and requests review via:
- PR review request (if supported)
- Label: `codex-review`
- Comment: `/codex review`

See `Specs/worktree-nightmanager.md` for full design.
