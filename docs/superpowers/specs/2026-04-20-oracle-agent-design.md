# Oracle Agent for Pi — Design Specification

**Date:** 2026-04-20  
**Author:** Sabyasachi Patra  
**Status:** Approved

## Overview

A new `oracle` custom tool for Pi that spawns a reasoning-focused subagent with its own isolated context window, configurable model, and evidence-oriented workflow. The Oracle agent is intended for cases where the main agent needs to debug tricky problems or plan nuanced changes and should "think really hard" before responding.

Oracle follows the same single-file extension structure and deployment style as `finder.ts`, but differs in purpose: Finder is optimized for search and discovery, while Oracle is optimized for diagnosis, causal analysis, and strategic recommendations.

The first version should remain narrow and consistent:
- one file: `oracle.ts`
- one tool: `oracle`
- one config file: `~/.pi/agent/oracle.json`
- same isolated-subagent architecture as Finder
- read-only in spirit: Oracle analyzes and recommends; it does not implement changes

## Goals

- Help the main agent debug tricky problems by finding underlying issues rather than surface symptoms
- Help the main agent reason through nuanced implementation or architectural decisions
- Preserve main-agent responsiveness by offloading slow, high-effort reasoning into an isolated subagent
- Return structured, evidence-backed conclusions the caller can act on immediately

## Non-Goals

- Implementing fixes directly
- Replacing Finder for general codebase search
- Acting as a generic code executor
- Becoming a broad multi-role agent for writing, editing, or refactoring code

## Architecture & Components

### 1. The `oracle` Tool Definition
- Registered via `pi.registerTool()`
- Parameters: `{ query: string }`
- Exposed to the main agent as a single tool call
- On execution, spawns a dedicated subagent with isolated state, model, and tools

### 2. The Subagent Session
The Oracle subagent should be created inside the tool `execute()` function, following the same structural pattern as Finder.

Properties:
- **Context window:** fully isolated from the main agent
- **Model:** configurable via `~/.pi/agent/oracle.json`, falling back to session model if absent
- **System prompt:** reasoning-focused, combining debugging, tracing, and architectural-analysis behaviors
- **Lifecycle:** exists only for the duration of the tool call

### 3. Progress Widget
`oracle.ts` should include an embedded `OracleProgress` class, mirroring the role of `FinderProgress`.

The widget should show:
- the main task line: `Oracle - analyzing <query>`
- currently running tool calls
- reasoning-oriented labels such as:
  - `Read auth.ts`
  - `Run npm test`
  - `Check diagnostics`
  - `Inspect git blame`
  - `Evaluate hypothesis`

The widget should preserve the same interaction model as Finder:
- tool execution adds rows
- turn completion marks them done
- only a bounded number of rows are shown
- the widget is disposed when the tool finishes

### 4. Shared Structure with Finder
To keep the repository coherent, `oracle.ts` should use the same top-level structure as `finder.ts`:
1. header docs
2. progress widget
3. schema and types
4. config loading
5. model resolution
6. system prompt
7. helper functions
8. tool registration
9. subagent execution loop
10. result rendering

This is a sibling implementation, not a new framework.

## Reasoning Model

Oracle should be a hybrid of three prompt styles researched from `/Users/sabyasachipatra/go/src/github.com/asabya/p2p-harness/prompts/p2p-harness`:

- `debugger.md` — root-cause analysis, reproduction-first debugging, minimal-fix recommendations
- `tracer.md` — competing hypotheses, evidence for/against, uncertainty tracking, discriminating probes
- `architect.md` — code-grounded analysis, concrete recommendations, trade-offs, read-only discipline

### Intended Behavior
Oracle is invoked when the main agent needs help with:
- debugging tricky or ambiguous failures
- identifying root causes across multiple possible explanations
- planning nuanced changes where trade-offs matter
- reasoning about the safest next step when evidence is incomplete

### Core Reasoning Loop
For each request, Oracle should:
1. Restate the problem as an observation
2. Frame the exact question being answered
3. Generate 2-3 competing hypotheses when ambiguity exists
4. Gather evidence for and against each hypothesis
5. Re-rank the hypotheses based on evidence strength
6. Produce either:
   - a best current explanation and recommendations, or
   - the critical unknown plus the highest-value next probe

### Reasoning Constraints
- Do not jump to a fix before understanding the problem
- Distinguish facts, inferences, and unknowns
- Prefer ranked hypotheses over fake certainty
- Collect evidence against the leading explanation, not just for it
- Keep a read-only posture: diagnose and recommend, do not modify code

## Tool Set

Oracle should start with an evidence-gathering tool set that is slightly broader than Finder's.

### Required tools
- `read`
- `grep`
- `find`
- `ls`
- `bash`

### Expected use
- **Read/Grep/Find/Ls** for discovering relevant code, config, and file relationships
- **Bash** for focused verification such as:
  - running tests
  - running build commands
  - checking git history with `git log` / `git blame`
  - running safe diagnostics commands

### Tool policy
Bash is allowed because Oracle needs to verify hypotheses, but Oracle should still behave as a read-only analyst:
- it may inspect and verify
- it should not use bash to mutate the repository
- it should not install dependencies
- it should not perform implementation actions

If additional Pi diagnostics tools are available during implementation, they may be included only if they reinforce Oracle's reasoning use case without expanding it into implementation.

## System Prompt Design

`oracle.ts` should contain a single `ORACLE_SYSTEM_PROMPT` constant, analogous to Finder's prompt constant.

The prompt should encode:
- identity: Oracle as a deep reasoning specialist
- why this matters: symptom-fixing and shallow conclusions are dangerous
- success criteria: evidence-backed explanation, competing hypotheses, clear recommendations
- constraints: read-only posture, no premature certainty, no implementation drift
- investigation protocol: observation → hypotheses → evidence → rebuttal → synthesis
- context budget guidance: avoid exhausting context on large files; prefer targeted reads
- execution policy: continue through clear reasoning steps automatically
- output format: required structured report
- failure modes to avoid
- final checklist

The prompt should explicitly support two user intents:
1. debugging tricky problems
2. planning nuanced changes

## Output Format

Oracle should return a structured report in this shape:

```md
## Observation
[What was observed, without interpretation]

## Hypothesis Table
| Rank | Hypothesis | Confidence | Evidence Strength |
|------|------------|------------|-------------------|
| 1 | ... | High / Medium / Low | Strong / Moderate / Weak |

## Evidence For
- Hypothesis 1: [file:line evidence]
- Hypothesis 2: [file:line evidence]

## Evidence Against / Gaps
- Hypothesis 1: [contradicting evidence or missing proof]
- Hypothesis 2: [contradicting evidence or missing proof]

## Current Best Explanation
[Best current explanation, explicitly provisional if needed]

## Recommendations
1. [Concrete action]
2. [Concrete action]

## Discriminating Probe
[Best next step to collapse remaining uncertainty]
```

This format intentionally supports both debugging and planning tasks:
- for debugging, the explanation should converge toward root cause
- for planning, the explanation should converge toward the safest justified direction and its trade-offs

## State Management & Execution Policy

### Status values
Recommended statuses:
- `initializing`
- `investigating`
- `reasoning`
- `synthesizing`
- `complete`
- `error`

### Limits
Oracle should be allowed more depth than Finder:
- **max turns:** 15
- **timeout:** 5 minutes
- **diminishing returns trigger:** 3 turns with no meaningful evidence change

### Stopping conditions
Oracle should stop when:
- one hypothesis clearly dominates
- evidence has plateaued for 3 turns
- max turns is reached
- timeout is reached
- the critical unknown is clear and the best next probe is identified

### Forced synthesis
When limits are reached, Oracle should be steered to synthesize rather than continue exploring:
- summarize findings
- rank remaining hypotheses
- state uncertainty explicitly
- recommend the next discriminating probe

## Data Flow

```text
Main Agent
  → calls oracle(query)
    → oracle execute()
      → resolve model from ~/.pi/agent/oracle.json or session model
      → create isolated Agent with ORACLE_SYSTEM_PROMPT and evidence tools
      → show OracleProgress widget
      → prompt subagent with user query
      → subagent investigates through multiple turns
      → event subscription tracks tools, turns, and evidence progression
      → if plateau/turn limit/timeout occurs, force synthesis
      → final structured report returned to main agent
      → widget disposed
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Empty query | Reject immediately with a clear error |
| No model available | Return setup guidance, matching Finder's style |
| Auth resolution failure | Return structured error details |
| Subagent error mid-run | Return error plus any partial findings gathered so far |
| Timeout | Return partial reasoning with explicit timeout note |
| No assistant response | Return structured fallback with discovered evidence summary |
| Repeated non-progress | Force synthesis instead of continuing |

## Testing Strategy

### 1. Prompt and behavior tests
Manual prompts should verify that Oracle behaves as a reasoning agent rather than a search agent.

Example prompts:
- `Use oracle to debug why auth middleware fails intermittently`
- `Use oracle to reason about why this build error keeps returning`
- `Use oracle to plan the safest way to refactor X`

Expected behaviors:
- restates observation
- produces competing hypotheses when ambiguity exists
- cites evidence for and against
- ends with a best explanation or discriminating probe
- avoids implementation drift

### 2. Tool-flow checks
Verify that Oracle:
- reads and searches before making conclusions
- runs tests/builds only when useful to validate hypotheses
- does not over-read large files
- synthesizes correctly after timeout, plateau, or max turns

### 3. UI checks
Verify that:
- the Oracle widget renders correctly
- tool rows update and complete properly
- partial states do not duplicate final output
- error states remain readable

## Implementation Recommendation

The first implementation should be intentionally conservative:
- create `oracle.ts` as a single-file sibling to `finder.ts`
- reuse Finder's config and model-resolution pattern
- reuse Finder's general event-subscription and widget lifecycle approach
- change the prompt, progress language, state tracking, and output structure to fit deep reasoning
- keep the scope focused on analysis and recommendations

## Research Notes

The Oracle design was informed by prompt research from:
- `/Users/sabyasachipatra/go/src/github.com/asabya/p2p-harness/prompts/p2p-harness/debugger.md`
- `/Users/sabyasachipatra/go/src/github.com/asabya/p2p-harness/prompts/p2p-harness/tracer.md`
- `/Users/sabyasachipatra/go/src/github.com/asabya/p2p-harness/prompts/p2p-harness/architect.md`

These prompt families contribute complementary behaviors:
- Debugger: disciplined root-cause investigation
- Tracer: competing explanations and evidence ranking
- Architect: concrete, trade-off-aware recommendations grounded in code

## Future Extensions

Out of scope for v1, but compatible with this design:
- specialized reasoning modes for debugging vs planning
- configurable depth or effort levels
- richer evidence summaries in the progress UI
- optional integration with more advanced diagnostics tools
- support for handing Oracle output into downstream planning tools
