# Night Shift Setup

This project includes a Pi/subagents Night Shift workflow.

## Files

- `AGENTS.md` — project router for agents.
- `AGENT_LOOP.md` — Day Shift and Night Shift operating procedure.
- `TODOs.md` — queue of eligible work.
- `Specs/` — human-authored specs. `draft-*` specs are ignored.
- `REVIEW_PERSONAS.md` — review lenses for manager/subagents.
- `.pi/prompts/nightshift.md` — non-interactive prompt used by the runner.
- `scripts/nightshift.sh` — cron/launchd entrypoint.

## Manual Run

From the repository root:

```bash
./scripts/nightshift.sh
```

Optional environment variables:

```bash
NIGHTSHIFT_MODEL=anthropic/claude-sonnet-4-5 \
NIGHTSHIFT_THINKING=high \
./scripts/nightshift.sh
```

If cron/launchd cannot find `pi`, set an absolute path:

```bash
PI_BIN=/Users/<you>/.nvm/versions/node/<version>/bin/pi ./scripts/nightshift.sh
```

If running this workflow from another repository, point at the built subagents extension:

```bash
SUBAGENTS_EXTENSION=/path/to/subagents/dist/index.js ./scripts/nightshift.sh
```

## Cron Example

Edit your crontab:

```bash
crontab -e
```

Run every weekday at 1:00 AM:

```cron
0 1 * * 1-5 cd /Users/sabyasachipatra/go/src/github.com/asabya/subagents && mkdir -p .pi/nightshift && PI_BIN=/Users/sabyasachipatra/.nvm/versions/node/v24.13.0/bin/pi ./scripts/nightshift.sh >> .pi/nightshift/cron.log 2>&1
```

The `mkdir -p` is intentional: shell redirection opens `.pi/nightshift/cron.log` before `scripts/nightshift.sh` can create its own log directories.

## macOS launchd Example

Create the log directory first because `launchd` will not create the parent directories for `StandardOutPath` or `StandardErrorPath`:

```bash
mkdir -p /Users/sabyasachipatra/go/src/github.com/asabya/subagents/.pi/nightshift
```

Create `~/Library/LaunchAgents/dev.asabya.subagents-nightshift.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>dev.asabya.subagents-nightshift</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd /Users/sabyasachipatra/go/src/github.com/asabya/subagents && PI_BIN=/Users/sabyasachipatra/.nvm/versions/node/v24.13.0/bin/pi ./scripts/nightshift.sh</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>1</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>/Users/sabyasachipatra/go/src/github.com/asabya/subagents/.pi/nightshift/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/sabyasachipatra/go/src/github.com/asabya/subagents/.pi/nightshift/launchd.err.log</string>
</dict>
</plist>
```

Load it:

```bash
mkdir -p /Users/sabyasachipatra/go/src/github.com/asabya/subagents/.pi/nightshift
launchctl load ~/Library/LaunchAgents/dev.asabya.subagents-nightshift.plist
```

Unload it:

```bash
launchctl unload ~/Library/LaunchAgents/dev.asabya.subagents-nightshift.plist
```

## Safety Notes

- Keep TODOs small and independently reviewable.
- Use `[draft]` and `draft-*` liberally. Only mark work `[ready]` when the spec is good.
- The runner has write and bash access. Run it only in repositories where autonomous commits are acceptable.
- The runner uses a lock directory to prevent overlapping runs.
- Logs and sessions are written under `.pi/nightshift/` and ignored by git.
