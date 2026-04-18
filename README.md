# Finder Subagent for Pi

A research implementation of AMP-style subagent orchestration for the pi CLI agent.

## What It Does

The `finder` tool spawns a dedicated search subagent with its own:
- **Context window** — isolated from the main agent, conserving context
- **Model** — uses the session's current model (configurable later)
- **Tool set** — read-only tools only (read, grep, find, ls)
- **System prompt** — tuned for codebase exploration with parallel search strategies

## Architecture

```
Main Agent
  │
  ├─ calls finder(query: "find auth middleware")
  │   │
  │   ├─ creates Agent instance (subagent)
  │   ├─ sends query with exploration system prompt
  │   ├─ runs multi-turn loop:
  │   │   ├─ model responds with tool calls
  │   │   ├─ executes tools in parallel
  │   │   ├─ tracks discovered files
  │   │   └─ detects diminishing returns
  │   └─ returns structured findings
  │
  └─ continues with findings in context
```

## Features

- **Parallel searches** — subagent launches 3+ searches from different angles
- **Broad-to-narrow strategy** — starts wide, refines based on findings
- **Context budget awareness** — avoids reading entire large files
- **Structured output** — Findings / Impact / Relationships / Recommendation / Next Steps
- **Diminishing returns detection** — auto-stops when no new files found for 2 turns
- **Turn limit** — max 10 turns prevents runaway searches
- **Timeout** — 60-second hard cap
- **Custom TUI rendering** — shows query in tool call, file count in collapsed result

## Installation

### Quick test
```bash
pi -e ./finder.ts
```

### Global installation
```bash
cp finder.ts ~/.pi/agent/extensions/finder.ts
```

## Usage

In pi, simply ask:
```
Use finder to find where authentication is handled
```

Or be more specific:
```
Use finder to find all files related to JWT token validation and the middleware chain
```

## Research Notes

This implementation demonstrates key subagent orchestration patterns:
1. **Context isolation** — subagent has its own transcript via separate `Agent` instance
2. **Tool scoping** — restricted to read-only tools (`read`, `grep`, `find`, `ls`)
3. **Model differentiation** — can use a different model (currently uses session's model)
4. **Lifecycle management** — turn limits, timeouts, diminishing returns via `agent.subscribe()`
5. **Structured communication** — defined input (query string) / output (structured text) contract
