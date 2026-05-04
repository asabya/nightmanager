# Spec: Manager delegate usage lines in live TUI

Status: ready
Owner: human
Created: 2026-05-04

## Problem

When `manager` spawns subagents, the live TUI inline display shows only the manager subagent's own usage. Usage for spawned delegates is not shown inside the manager card, so users cannot see which `finder`, `oracle`, or `worker` calls are consuming tokens/cost/context during an orchestrated run.

GitHub issue: https://github.com/asabya/nightmanager/issues/13

## Goals

- Show a separate inline usage line for each subagent spawned by `manager`.
- Update spawned subagent usage live while each delegate is running.
- Keep each spawned subagent line visible after that delegate completes.
- Keep manager usage separate from child subagent usage; do not aggregate child usage into the manager total.
- Use the same usage label fields and formatting as existing subagent usage labels.
- Show all completed/running spawned subagent lines, not only the latest few.
- Support both collapsed and expanded manager displays if practical.

## Non-Goals

- Do not change direct `finder`, `oracle`, `worker`, or `manager` card usage behavior except where needed for nested manager delegates.
- Do not roll up child usage into the parent manager label.
- Do not invent a new usage format or billing convention.
- Do not add GitHub issue/PR automation changes.
- Do not change non-manager custom tool rendering.

## Current Behavior

Relevant files/modules:

- `src/tools/manager.ts` wraps delegated tools with `trackDelegation(...)`, records delegate call status/summary, and forwards the manager transcript through `runIsolatedSubagent` updates.
- `src/core/subagent.ts` captures live usage snapshots for isolated subagent runs and emits transcript details through `onUpdate`.
- `src/core/subagent-rendering.ts` formats and renders built-in subagent usage labels through `formatUsageLabel(...)`, `buildCollapsedPreview(...)`, and `buildExpandedTranscript(...)`.
- `src/core/transcript.ts` defines transcript usage/details structures.
- Existing tests include `tests/unit/subagent-rendering.test.ts` and integration coverage around manager/subagent tools.

Today the manager card already shows its own inline usage. When the manager invokes `finder`, `oracle`, or `handoff_to_worker`/`worker`, the manager display may show delegate activity, but it does not show a separate live usage label for each spawned delegate.

## Desired Behavior

When `manager` invokes built-in delegate subagents, the manager card should render one stable line per spawned delegate. Each line should identify the delegate and show its usage independently from the manager usage.

Representative collapsed/expanded manager content:

```text
↑12.1k ↓1.4k $0.031 6.8%/200k
✓ Finder search render usage paths · ↑3.2k ↓420 $0.004 1.8%/200k
⠼ Oracle reason about update propagation · $0.000 0.0%/200k
✓ Worker patch manager delegate usage · ↑9.8k ↓1.1k $0.022 5.5%/200k
```

Rules:

1. Manager's own usage remains the existing manager label and contains only the manager subagent's own usage.
2. Each spawned delegate gets a separate line:
   - `finder` displays as `Finder ...`.
   - `oracle` displays as `Oracle ...`.
   - `handoff_to_worker` / `worker` displays as `Worker ...`.
3. Each delegate line updates live while the delegate is running.
4. Each delegate line remains visible after the delegate completes, fails, aborts, or times out.
5. All running/completed delegate lines remain visible; do not collapse to only the latest few for this manager delegate usage list.
6. The usage suffix uses the same fields and formatting as existing usage labels: input tokens, output tokens, cost, and context percentage/window when available.
7. Before input/output usage is first reported for a delegate, do not show input/output token counts. Show placeholder cost/context based on that spawned subagent's own model context window, e.g. `$0.000 0.0%/200k`.
8. The placeholder context window must come from the spawned delegate's model/config, not from the manager model.
9. The behavior should appear in both collapsed and expanded manager displays if possible.

## Acceptance Criteria

- [ ] Manager live TUI shows a separate line for each spawned `finder`, `oracle`, and `handoff_to_worker`/`worker` delegate.
- [ ] Each spawned delegate line updates usage live while the delegate is running.
- [ ] Each spawned delegate line remains visible after completion, failure, abort, or timeout.
- [ ] Manager usage remains separate and does not include/aggregate spawned delegate usage.
- [ ] Delegate usage labels use the same field order/rounding/symbols as existing `formatUsageLabel(...)` output when real usage is available.
- [ ] Before real input/output usage is available, delegate lines omit input/output counts and show `$0.000 0.0%/<delegate context window>`.
- [ ] Placeholder context windows come from each delegate's own resolved model context window.
- [ ] All completed/running delegate lines remain visible in the manager display.
- [ ] Expanded manager display includes the delegate usage lines if the rendering model supports it without awkward duplication.
- [ ] `handoff_to_worker` delegates are presented to users as `Worker` lines.

## Edge Cases

- A delegate provider only emits usage at the end; the delegate line should show placeholder cost/context until final usage arrives.
- A delegate fails before emitting usage; the placeholder should remain visible using that delegate's model context window.
- A delegate emits partial usage then fails/cancels; the last known partial usage should remain visible.
- Multiple delegates run sequentially or concurrently; each should keep its own line and not overwrite another delegate's usage.
- A delegate has no resolved model context window; rendering should degrade gracefully rather than showing the manager context window.
- Frequent usage updates should not cause excessive TUI flicker or repeated full-card resets.

## Suggested Approach

- Extend the manager delegate tracking structure in `src/tools/manager.ts` to store live delegate transcript/usage details, not only status and summary.
- When wrapping delegated tools in `trackDelegation(...)`, intercept each delegate tool's `onUpdate` callback and copy its latest transcript usage/details into the matching delegate record before forwarding updates as needed.
- Resolve each delegate's configured model/context window for placeholder rendering. For `handoff_to_worker`, use worker's resolved model/config.
- Add a small rendering helper in `src/core/subagent-rendering.ts` for manager delegate usage lines that reuses `formatUsageLabel(...)` for real usage and a compatible placeholder formatter for pre-usage state.
- Teach the manager renderer/result path to pass delegate usage records to the shared renderer, or embed them into manager transcript details in a typed way that `buildCollapsedPreview(...)` and `buildExpandedTranscript(...)` can render.
- Add tests that exercise manager delegate records with no usage, partial usage, final usage, and worker handoff display naming.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Additional validation:

- Extend `tests/unit/subagent-rendering.test.ts` to cover manager delegate usage lines, placeholder formatting, real usage formatting, and `handoff_to_worker` displayed as `Worker`.
- Add or extend manager tests to verify delegate `onUpdate` usage is captured independently from manager usage.
- Manual Pi TUI check:
  - run a manager task that invokes finder/oracle/worker;
  - confirm manager's own usage stays separate;
  - confirm each spawned delegate line appears while running;
  - confirm placeholder `$0.000 0.0%/<context>` appears before input/output usage;
  - confirm final usage remains after completion.

## Documentation Updates

No public documentation update is required unless implementation exposes a new user-facing limitation. Inline comments may be useful around manager delegate usage tracking and placeholder context-window resolution.

## Risks / Open Questions

- The existing transcript detail types may need a backwards-compatible extension to represent child delegate usage without implying usage rollups.
- Rendering all delegate lines could make very long manager runs visually noisy; this is intentional per current requirement, but may need future collapsing controls.
- Some providers/models may not expose context windows consistently; placeholder behavior should degrade safely.
- The exact TUI rendering path for partial manager result updates may constrain how easily expanded and collapsed views can share the same delegate usage data.
