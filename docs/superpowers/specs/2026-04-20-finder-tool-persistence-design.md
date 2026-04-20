# Finder Tool Persistence Widget Design

## Overview

Update the finder progress widget in `finder.ts` so the widget reliably shows tool rows while finder runs.

The widget should render above the editor as:

```text
⠼ Finder Task - Read and display the contents of README.md file in the current working directory
   ⠼ Tool 1 read
   ⠼ Tool 2 grep
```

Pi's default `Working...` indicator should remain below the widget.

## Goals

- Keep the main finder task line visible for the duration of the finder run
- Show tool rows reliably instead of clearing them too aggressively
- Preserve tool rows after completion for now
- Order visible rows as:
  1. currently running tools first
  2. recent completed tools after that
- Cap visible tool rows at 5
- Show a `+ N more` overflow line when more than 5 tool entries exist
- Keep labels minimal: `Tool N <toolName>`

## Non-Goals

- No changes to global `Working...` placement or pi-tui internals
- No rich argument summaries in tool rows
- No persistence beyond the lifetime of a finder execution
- No separate file extraction or refactor outside `finder.ts`

## Current Problem

The current implementation adds tool loaders on `tool_execution_start` but clears all tools on `turn_end`. That means tool rows can disappear before they are useful, which matches the reported behavior that tools do not show up reliably.

## Proposed Approach

Use a state-model rewrite inside `FinderProgress`.

### FinderProgress state

Track tool entries as explicit records instead of only a map of active loaders.

Each tool entry will contain:

- `id`: stable identifier for the tool call when available
- `toolName`: the raw tool name such as `read`, `grep`, `bash`
- `label`: display text in the form `Tool N <toolName>`
- `status`: `running` or `done`
- `sequence`: increasing integer assigned at creation time
- `loader`: loader instance for running entries only

### Event handling

#### On `tool_execution_start`

- Create a new tool entry
- Assign the next sequence number and label (`Tool 1 read`, `Tool 2 bash`, etc.)
- Mark it as `running`
- Create and attach a loader for animated rendering
- Trigger a render

#### On completion

Finder currently receives enough lifecycle data to clear state at turn boundaries, but that is too aggressive. The new behavior should instead mark known running entries as completed when the turn finishes.

Implementation behavior:

- At `turn_end`, convert currently running entries to `done`
- Stop their loaders
- Keep them in the list so they remain visible
- Trigger a render

This preserves visibility even if exact per-tool completion correlation is not available in the current event stream.

## Rendering Rules

### Main line

Always render the main task line first using the existing loader:

```text
⠼ Finder Task - <query>
```

### Tool lines

Visible tool lines are selected using this order:

1. all `running` entries in creation order
2. completed entries in reverse completion/recency order

Display up to 5 total tool lines.

Examples:

```text
⠼ Finder Task - Find README.md files
   ⠼ Tool 1 read
   ⠼ Tool 2 grep
   ⠼ Tool 3 bash
```

After some tools complete:

```text
⠼ Finder Task - Find README.md files
   ⠼ Tool 4 find
   ⠼ Tool 5 read
   Tool 3 bash
   Tool 2 grep
   Tool 1 read
```

Completed lines become static text without a spinner.

### Overflow

If more than 5 entries exist after applying ordering:

```text
   + N more
```

## Why this solves the bug

The main issue is not widget placement, but lifetime of tool rows. Replacing `clearTools()` at `turn_end` with status transitions preserves the rows long enough for users to see them. This directly addresses the complaint that tool rows do not show up.

## File Changes

### Modify `finder.ts`

- Replace the current `toolLoaders`-only progress model with explicit tool-entry state
- Add ordering and rendering logic for running-first then recent-completed
- Change turn-end handling to mark tools done instead of clearing them
- Keep widget placement as `aboveEditor`
- Leave `renderCall` and `renderResult` minimal so the widget remains the primary progress display

## Testing Plan

1. Run finder with a query that triggers multiple tool calls
2. Verify the widget shows the main finder task line
3. Verify tool rows appear as `Tool N <toolName>`
4. Verify Pi's `Working...` appears below the widget
5. Verify completed tools remain visible
6. Verify running tools appear before completed tools
7. Verify `+ N more` appears when more than 5 tool entries are tracked
8. Verify widget cleanup still happens on success, error, and abort

## Risks

- Marking all running entries done at `turn_end` may be slightly approximate if a future finder run spans tools across unusual turn boundaries, but it is acceptable for the current behavior and better than clearing everything.
- If exact per-tool completion events become available later, the same state model can adopt them without another redesign.
