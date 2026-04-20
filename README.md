# Finder Subagent for Pi

A research implementation of AMP-style subagent orchestration for the pi CLI agent.

## How Model Selection Works

The finder resolves its model in this order:
1. **`~/.pi/agent/finder.json`** — simple `{"model": "provider/modelId"}` reference to any model in your `models.json`
2. **Session model** — whatever model you have set for the current Pi session

No separate provider registration needed. It reuses Pi's existing model registry for auth, base URLs, and headers.

## What It Does

The `finder` tool spawns a dedicated search subagent with its own:
- **Context window** — isolated from the main agent, conserving context
- **Model** — configurable via `~/.pi/agent/finder.json`, falls back to session model
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

### 1. Set the model (optional)
Create `~/.pi/agent/finder.json` with a model reference:
```json
{
  "model": "ollama/glm-5:cloud"
}
```
The format is `provider/modelId` — it must match an entry in your `~/.pi/agent/models.json`.
If omitted, the finder uses whatever session model you have active.

### 2. Install
```bash
# Quick test
pi -e ./finder.ts

# Or install globally (single file - no dependencies)
cp finder.ts ~/.pi/agent/extensions/finder.ts
```

Note: The entire extension is self-contained in a single `finder.ts` file, including the progress widget.

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
