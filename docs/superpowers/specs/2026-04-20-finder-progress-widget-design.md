# Finder Progress Widget Design

## Overview

Add a progress indicator to the finder extension using the TUI's `Loader` component. The indicator displays above the editor while the finder subagent is actively searching, showing a spinning animation and status message.

## Motivation

Currently, finder's progress is only visible in the tool result area via `renderResult`. Users have no indication in the main TUI that a search is in progress. Using the existing `Loader` component ensures visual consistency and reduces maintenance burden.

## Architecture

```
┌─────────────────────────────────────────┐
│ Header / Chat                           │
├─────────────────────────────────────────┤
│ ⠋ Searching: grep...          ← Widget │  ← aboveEditor placement
├─────────────────────────────────────────┤
│ Input Editor                            │
└─────────────────────────────────────────┘
```

## Components

### FinderProgress Component

A thin wrapper around `Loader` that implements the `Component` interface for widget compatibility.

**File**: `finder-progress.ts`

```typescript
import type { Component } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-ai";
import { Loader } from "@mariozechner/pi-tui";

export class FinderProgress implements Component {
  private loader: Loader;

  constructor(
    tui: TUI,
    theme: Theme,
    message: string = "Searching..."
  ) {
    this.loader = new Loader(
      tui,
      theme.fg("accent"),   // spinner color
      theme.fg("muted"),     // message color
      message
    );
  }

  setMessage(message: string): void {
    this.loader.setMessage(message);
  }

  dispose(): void {
    this.loader.stop();
  }

  render(width: number): string[] {
    return this.loader.render(width);
  }

  invalidate(): void {
    this.loader.invalidate();
  }
}
```

**Responsibilities**:
- Wraps `Loader` component
- Provides `setMessage()` for dynamic text updates
- Implements `Component` interface
- Cleans up animation interval via `dispose()`

### Widget Lifecycle in finder.ts

**State Management**:
- Module-level variable holds reference to current `FinderProgress` instance
- Single reference is sufficient (finder executes one search at a time)

**Lifecycle**:
1. `execute()` starts → create and show widget
2. During search → update message via reference
3. Search completes/errors → clear widget and dispose

**Integration Point**:

```typescript
let finderProgress: FinderProgress | null = null;

async execute(toolCallId, params, signal, onUpdate, ctx) {
  // Show progress widget
  ctx.ui.setWidget("finder", (tui, theme) => {
    finderProgress = new FinderProgress(tui, theme, "Searching...");
    return finderProgress;
  }, { placement: "aboveEditor" });

  try {
    // Run subagent...
    agent.subscribe((event) => {
      if (event.type === "tool_execution_start") {
        finderProgress?.setMessage(`Searching: ${event.toolName}...`);
      }
      // ... other events
    });
    await agent.prompt(params.query);
    await agent.waitForIdle();
  } finally {
    // Always clean up
    ctx.ui.setWidget("finder", undefined);
    finderProgress?.dispose();
    finderProgress = null;
  }
}
```

## Message Updates

| Phase | Message |
|-------|---------|
| Initial | `"Searching..."` |
| Tool execution | `"Searching: grep..."` / `"Searching: find..."` |
| Files found | `"Found 5 files..."` |
| Summarizing | `"Summarizing results..."` |
| Complete | Widget cleared |

## Error Handling

- `try/finally` ensures widget cleanup even on errors
- `dispose()` called on cleanup stops Loader's animation interval
- No resource leaks (interval cleared, widget removed)

## Files Changed

| File | Change |
|------|--------|
| `finder-progress.ts` | New file - FinderProgress component |
| `finder.ts` | Integrate widget lifecycle and message updates |

## Dependencies

- `@mariozechner/pi-tui` - `Loader`, `TUI`, `Component` types
- `@mariozechner/pi-ai` - `Theme` type

## Testing

Manual testing scenarios:
1. Basic search → widget appears, animates, disappears on completion
2. Search with tool calls → message updates with tool name
3. Search error → widget still cleans up properly
4. Interrupt (Ctrl+C) → widget cleans up on abort