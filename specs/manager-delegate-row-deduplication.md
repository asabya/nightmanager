# Spec: Deduplicate manager delegate rows in the live TUI

Status: active
Owner: human
Created: 2026-05-05

## Problem

When `manager` spawns `finder`, `oracle`, or `worker`/`handoff_to_worker`, the live TUI currently shows the same delegate call twice inside the manager card: once as the manager delegate usage line and again as a nested subagent/tool row without usage stats. This makes the manager display noisy and confusing.

## Goals

- Show exactly one visible row per manager delegate call.
- Keep the row that includes usage stats.
- Remove the duplicate nested Finder/Oracle/Worker/Handoff row from the manager display.
- Preserve manager usage separately from delegate usage.
- Keep live usage updates working on the remaining row.

## Non-Goals

- Do not change direct `finder`, `oracle`, or `worker` tool rendering outside manager nesting.
- Do not change token/cost formatting.
- Do not aggregate delegate usage into the manager total.
- Do not redesign the overall TUI layout.

## Current Behavior

Relevant files/modules:

- `src/tools/manager.ts` builds manager delegate tracking data and forwards transcript updates.
- `src/core/subagent-rendering.ts` renders manager collapsed and expanded content from both `managerDelegateCalls` and `entries`.
- `src/core/transcript.ts` defines `managerDelegateCalls` and transcript entries.
- `tests/unit/subagent-rendering.test.ts` already covers manager delegate usage rendering.

Today the manager view can render both of these for the same delegate call:

1. a manager delegate usage summary line such as `✓ Finder ... · ↑11.2k ↓839 ...`
2. a second nested tool row for the same delegate call such as `✓ Finder ...`

That produces duplicate Finder/Oracle/Worker/Handoff lines in the same manager card.

## Desired Behavior

For a manager run, each delegate call should appear once and only once in the manager card.

- The visible line should be the manager delegate usage line.
- That line should continue to update as usage becomes available.
- Any raw nested delegate row for the same call should be suppressed.
- Manager usage should still appear once at the top of the manager card.

Representative output:

```text
✓ Manager Task - Fix repo housekeeping issues: update spec files so completed specs no longer say ready/active; …
     ↑4.8k ↓146 $0.004 1.8%/272k
     ✓ Finder Find spec markdown files and any metadata conventions for status/state/… · ↑11.2k ↓839 $0.012 4.4%/272k
     ✓ Oracle Given a repo housekeeping request to update completed spec statuses fro… · ↑5.3k ↓1.6k $0.088 11.6%/272k
     ✓ Worker Implement the minimal safe repo-housekeeping update for completed specs… · ↑0 ↓0 $0.000 0.0%/272k
```

## Acceptance Criteria

- [ ] Manager card shows only one row per delegate call.
- [ ] The remaining row includes usage stats when available.
- [ ] Duplicate nested Finder/Oracle/Worker/Handoff rows are no longer rendered inside the manager card.
- [ ] Manager usage still appears separately and only once.
- [ ] Live updates still refresh the remaining delegate row as usage changes.
- [ ] `handoff_to_worker` continues to display as `Worker`.
- [ ] Unit tests cover a manager transcript that contains both `managerDelegateCalls` and matching delegate `tool_call` entries and assert that only one visible row remains per delegate.

## Edge Cases

- A delegate has no usage yet: the single row should still render using the placeholder usage behavior already used by manager delegate lines.
- A delegate fails or times out after emitting partial usage: the remaining row should keep the latest state and still appear only once.
- Multiple delegates run in sequence: each should still produce one row, not one row per transcript entry.

## Suggested Approach

- Update manager rendering so delegate rows are sourced from `managerDelegateCalls` only.
- Filter or skip raw transcript `tool_call` entries for manager-spawned delegates when building the manager preview/transcript.
- Keep the existing delegate usage line formatter and placeholder behavior.
- Add/extend tests in `tests/unit/subagent-rendering.test.ts` for duplicate suppression.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Additional validation:

- Extend `tests/unit/subagent-rendering.test.ts` with a fixture that includes both delegate usage records and duplicate raw delegate calls, then assert only one row appears for Finder/Oracle/Worker.
- Manual TUI check:
  - run a manager task that delegates to finder/oracle/worker;
  - confirm each delegate appears once;
  - confirm the visible row is the one with usage stats.

## Documentation Updates

No public docs update required.

## Risks / Open Questions

- The manager transcript may still need raw delegate entries for other internal uses, so filtering should be limited to rendering.
- Expanded transcript behavior should match collapsed view unless a separate design is needed later.
