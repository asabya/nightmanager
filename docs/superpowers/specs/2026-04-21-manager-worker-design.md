# Manager + Worker The Nightmanager Design

Date: 2026-04-21
Status: Draft approved in conversation; written for review before implementation

## Summary

Add two new Pi nightmanager alongside the existing `finder` and `oracle` tools:

- `manager` — a read-only routing/orchestration subagent
- `worker` — a focused implementation subagent

The design goal is a high token-cost to performance ratio:

- keep prompts lightweight
- avoid role explosion
- avoid deep multi-agent chaining in v1
- preserve clear separation of concerns
- reuse the existing single-file extension pattern used by `finder.ts` and `oracle.ts`

This design explicitly keeps P2P and distributed orchestration out of scope for v1.

## Goals

- Keep `finder` and `oracle` as the existing research and reasoning specialists
- Add a `manager` tool that classifies requests and routes to one best-fit subagent by default
- Add a `worker` tool that performs implementation work with verification discipline
- Preserve lightweight prompts and compact tool contracts
- Keep the new nightmanager user-facing while still usable internally by other tools

## Non-Goals

- P2P networking or distributed execution
- CEO/manager/worker hierarchy from `p2p-harness`
- Automatic multi-agent chains like `finder -> oracle -> worker` in v1
- Recursive delegation
- `manager` editing files
- `worker` calling `oracle`
- Large prompt libraries or stacked persona prompts

## Existing Context

The repository currently contains two Pi extension-based nightmanager:

- `finder.ts` — read-heavy exploration/search specialist
- `oracle.ts` — evidence-backed reasoning/diagnostic specialist

Both use the same core pattern:

- register a Pi tool
- create a dedicated `Agent` instance per invocation
- run with a focused system prompt
- use bounded turn counts and timeouts
- stream progress to the TUI
- return structured text

`manager` and `worker` should reuse this pattern.

## Approach Options Considered

### 1. Thin Router

A very small router that usually delegates one request to one agent and does little else.

Pros:
- cheapest
- easiest to reason about

Cons:
- too passive for some ambiguous tasks
- less valuable as a user-facing tool

### 2. Balanced Manager-Worker Stack

A read-only `manager` classifies and routes to exactly one best-fit subagent by default. A `worker` performs implementation with verification and one constrained `finder` fallback.

Pros:
- best token-cost to performance ratio
- clear role boundaries
- strong reuse of current architecture
- low orchestration overhead

Cons:
- no deep multi-agent chaining in v1
- complex tasks may still rely on the main agent to chain tools manually

### 3. Mini Hierarchy

A stronger orchestrator that decomposes and chains phases across `finder`, `oracle`, and `worker`.

Pros:
- closer to the `p2p-harness` mental model
- more autonomous for complex tasks

Cons:
- higher prompt complexity
- higher token cost
- higher risk of duplicated reasoning

## Recommended Approach

Use **Approach 2: Balanced Manager-Worker Stack**.

Rationale:
- fits the existing `finder` / `oracle` pattern
- preserves lightweight prompts
- adds useful routing and implementation specialization without building an expensive orchestration layer
- creates a clean v1 baseline that can be expanded later

## Roles and Boundaries

### Manager

Purpose:
- classify incoming requests
- decide whether the task is ready for execution
- route to exactly one best-fit subagent by default
- remain read-only

Default behavior:
- clear implementation request -> route to `worker`
- codebase discovery request -> route to `finder`
- debugging, tradeoff, or root-cause request -> route to `oracle`
- unclear request -> ask one clarifying question or recommend the next agent

Constraints:
- no file edits
- no implementation workflow
- no multi-agent chaining in v1
- no direct code execution beyond what is required to invoke a delegated subagent

Personality / policy:
- balanced
- single-delegate by default
- user-facing and internal
- auto-route clear implementation tasks without stopping to propose a plan first

### Worker

Purpose:
- execute implementation tasks
- prefer the smallest viable change
- verify results before claiming success
- use `finder` once if blocked by codebase uncertainty

Default behavior:
1. understand the task
2. inspect relevant files
3. attempt test-first work when practical
4. implement the change
5. run verification
6. return concise result with evidence

Constraints:
- no recursive delegation
- no `oracle` calls
- no broad refactors unless explicitly requested
- no speculative cleanup
- no success claims without verification evidence

TDD stance:
- prefer test-first when there is a natural existing test location or obvious harness
- if there is no test harness or no proportional place to add a test, fall back to implementation plus verification commands

This is effectively **TDD when natural, verification-first always**.

### Finder

Unchanged in v1.

Role:
- codebase exploration
- search and evidence gathering
- read-only investigation

### Oracle

Unchanged in v1.

Role:
- evidence-backed reasoning
- debugging and root-cause analysis
- tradeoff-aware planning

## Routing Policy

`manager` takes a single natural-language query and classifies the task into one of:

- `search`
- `reasoning`
- `implementation`
- `ambiguous`

### Routing Decisions

- `search` -> `finder`
- `reasoning` -> `oracle`
- `implementation` -> `worker`
- `ambiguous` -> ask one clarifying question or recommend the best next agent

### Auto-Route Policy

When the task is clearly implementable, `manager` should route to `worker` immediately. It should not stop to provide a plan first.

### Not-Ready Tasks

If implementation is requested but the task is not ready:
- lack of codebase context -> recommend `finder`
- uncertainty or competing explanations -> recommend `oracle`
- underspecified request -> ask one clarifying question

### Deliberate v1 Limitation

`manager` should not automatically chain `finder -> oracle -> worker` or spawn multiple agents for one request in v1.

This keeps token cost low and behavior predictable.

## Prompt and Contract Architecture

The design should keep prompts thin and machine-oriented.

### Prompt Structure

Each new subagent should have:
1. a short shared base prompt
2. a small role overlay
3. a structured output contract

### Shared Base Prompt

Target size: roughly 200-350 tokens.

Should cover only:
- role-scoped behavior
- evidence discipline
- stop conditions
- concise outputs
- no long persona prose

### Manager Overlay

Target size: roughly 80-180 tokens.

Should emphasize:
- classify task shape
- choose one best delegate
- auto-route implementation tasks
- ask at most one clarifying question when needed
- remain read-only

### Worker Overlay

Target size: roughly 80-180 tokens.

Should emphasize:
- inspect before editing
- smallest viable diff
- test-first when natural
- verify thoroughly
- use `finder` once only if blocked
- return evidence, not confidence language

### Input Contracts

Keep the API narrow in v1:

- `manager(query: string)`
- `worker(task: string)`

No elaborate configuration surface initially.

### Output Contracts

#### Manager output

Should return compact structured text containing:
- `Task shape`
- `Decision`
- `Why`
- `Action taken`
- `Next step`

If it delegates, the delegated output should be the useful core result, prefixed with only a short routing summary.

#### Worker output

Should return compact structured text containing:
- `Status`
- `Summary`
- `Files changed`
- `Verification`
- `Next step` when blocked or partial
- `Fallback used` indicating whether `finder` was invoked

## Tool Access

### Manager tool scope

`manager` should be able to call:
- `finder`
- `oracle`
- `worker`

It remains read-only by policy.

### Worker tool scope

`worker` should have:
- `read`
- `edit`
- `write`
- `bash`
- constrained access to `finder`

The `finder` constraint is:
- at most one use per task
- only for codebase uncertainty
- no recursive delegation

## Runtime Policy

### Manager runtime policy

- low latency
- small turn cap
- fast routing decision
- single delegation at most in v1

### Worker runtime policy

- moderate turn cap
- enough room for inspect -> edit -> verify
- bounded `finder` fallback

## User-Facing Behavior

Both tools should be user-facing and internally callable.

### Manager

Users should be able to say things like:
- "Use manager to decide how to approach this task"
- "Use manager to route this implementation request"

### Worker

Users should be able to say things like:
- "Use worker to implement this change"
- "Use worker to make the smallest fix and verify it"

This gives power users a direct implementation path while still keeping `manager` useful as a routing layer.

## Error Handling

### Manager

If delegation fails, return:
- chosen route
- failure reason
- recommended next action

### Worker

If blocked, return:
- what blocked execution
- what was inspected
- whether fallback was used
- exact next step needed

## Verification Expectations

For v1, success means:
- `manager` routes correctly and cheaply
- `worker` produces small, verified changes
- `finder` and `oracle` remain unchanged
- all four tools have clearly differentiated roles

## File Layout

Add two new files at repo root alongside the existing extensions:

- `finder.ts`
- `oracle.ts`
- `manager.ts`
- `worker.ts`

The repo should continue to favor self-contained single-file extensions for easy installation and iteration.

## Configuration

Follow the same model-selection pattern as the existing tools:

- `~/.pi/agent/manager.json`
- `~/.pi/agent/worker.json`

Each may optionally contain:

```json
{
  "model": "provider/modelId"
}
```

Fallback behavior:
- use tool-specific config model if present
- otherwise use the active session model

## Risks and Tradeoffs

### Risk: manager adds overhead without enough value
Mitigation:
- keep manager prompt small
- route to one delegate only
- avoid essay-like planning output

### Risk: worker becomes too autonomous
Mitigation:
- keep role boundaries explicit
- no `oracle`
- one `finder` fallback maximum
- no recursive delegation

### Risk: TDD becomes inconsistent
Mitigation:
- state the policy clearly: test-first when natural, otherwise implementation plus verification
- require verification evidence in all cases

## Future Extensions

Possible later enhancements, explicitly deferred from v1:
- configurable autonomy levels for `manager`
- multi-step or chained delegation
- stronger planning mode
- richer task packets
- fine-grained risk scoring for auto-route decisions
- P2P/distributed orchestration layer

## Spec Self-Review

### Placeholder scan
No TODO/TBD placeholders remain.

### Internal consistency
The role boundaries, routing rules, and tool scopes are consistent with the stated lightweight-token objective.

### Scope check
This is focused enough for a single implementation plan covering two new tools plus documentation updates.

### Ambiguity check
The main intentionally flexible area is TDD behavior; this spec makes the policy explicit: test-first when natural, otherwise implement plus verify.

## Final Recommendation

Implement `manager.ts` and `worker.ts` as lightweight, self-contained Pi subagent extensions that reuse the existing `finder`/`oracle` architecture, keep prompts small, preserve strict role boundaries, and optimize for token-cost to performance rather than maximum orchestration autonomy.
