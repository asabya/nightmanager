# Two-Line Finder Progress Widget Design

## Overview

Redesign the finder subagent's progress display to show a two-line status:
1. Main task line with animated loader showing the query
2. Tab-indented tool lines showing currently running tools (up to 5)

Both loaders animate independently, giving visual feedback during parallel searches.

## Current Behavior

```
🔍 finder "Find README.md files..."  
   Searching... turn 0/10, 0 files  
                                  
⠴ Working...                      
```

## New Behavior

```
⠼ Finder Task - Find README.md files in the current working directory...
   ⠼ Read README.md
   ⠼ Grep auth
   ⠼ Find package.json

⠋ Working...
```

When no tools are running (initial state), only the main line shows:
```
⠼ Finder Task - Find README.md files in the current working directory...

⠋ Working...
```

When more than 5 tools are running:
```
⠼ Finder Task - Find README.md files...
   ⠼ Read README.md
   ⠼ Grep auth
   ⠼ Find package.json
   ⠼ Ls src/
   ⠼ Read config.json
   + 3 more

⠋ Working...
```

## Component Design

### FinderProgress Class

```typescript
class FinderProgress implements Component {
  private tui: TUI;
  private theme: Theme;
  private mainLoader: Loader;
  private toolLoaders: Map<string, { loader: Loader; input: string }>;
  private intervalId: NodeJS.Timeout;
  private frames: string[];
  private mainFrame: number;
  private query: string;
  
  constructor(tui: TUI, theme: Theme, query: string) {
    // Initialize main loader (always visible)
    // Start single interval for frame updates
  }
  
  addTool(toolName: string, input: string): void;
  removeTool(toolName: string): void;
  clearTools(): void;
  dispose(): void;
  render(width: number): string[];
  invalidate(): void;
}
```

### Key Design Decisions

1. **Two independent Loader instances for each line** - Each uses its own 80ms interval for truly independent animation feel.

2. **Tool tracking via Map** - `toolLoaders: Map<string, { loader, input }>` keyed by tool name + truncated input for uniqueness.

3. **Cap at 5 tools** - Prevents display overflow. Shows "+ N more" indicator when exceeded.

4. **Single interval for main loader** - The main task loader animates independently. Tool loaders each have their own intervals via the Loader class.

## Integration with execute()

### Event Handling

| Event | Action |
|-------|--------|
| `tool_execution_start` | Call `finderProgress?.addTool(toolName, input)` |
| `turn_end` | Parse `toolResults`, call `removeTool()` for each completed tool |

### Code Flow

```typescript
// In execute()
ctx.ui.setWidget("finder", (tui, theme) => {
  finderProgress = new FinderProgress(tui, theme, params.query);
  return finderProgress;
}, { placement: "aboveEditor" });

agent.subscribe((event) => {
  if (event.type === "tool_execution_start") {
    const toolName = event.toolName;
    const input = formatToolInput(toolName, event.args);
    finderProgress?.addTool(toolName, input);
  }
  
  if (event.type === "turn_end") {
    const toolResults = (event as any).toolResults || [];
    for (const result of toolResults) {
      // Extract tool name from result and remove
      finderProgress?.removeTool(result.toolName);
    }
  }
});

// In finally block
finderProgress?.dispose();
ctx.ui.setWidget("finder", undefined);
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No model available | Skip widget, show error message (current behavior) |
| Tool execution fails | Still remove from runningTools on turn_end |
| Query empty | Return error before creating widget |

## Files Changed

- `finder.ts` - Rewrite `FinderProgress` class and update `execute()` event handling

## Testing Plan

1. Run finder with a broad query that triggers multiple parallel tools
2. Verify both loaders animate independently
3. Verify tool lines appear/disappear as tools start/complete
4. Verify overflow indicator shows when >5 tools running
5. Verify widget cleans up properly on dispose