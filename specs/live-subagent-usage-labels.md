# Spec: Live Pi-style usage labels on built-in subagent cards

Status: ready
Owner: human
Created: 2026-04-30

## Problem

Built-in subagent cards (`finder`, `oracle`, `worker`, `manager`) show activity and final transcript text, but they do not surface live token/cost usage inline the way Pi shows usage in the main chat UI. That makes nested delegation harder to scan and makes subagent cards feel different from default Pi. The new label needs to match Pi’s native style so it does not introduce a confusing second convention.

## Goals

- Show a compact, live usage label on every built-in subagent card.
- Keep the label Pi-style: same visual language, same ordering, same rounding, same symbols, no custom shorthand.
- Update only the direct subagent’s own usage/cost, not any child subagents it spawned.
- Keep the label visible after completion, failure, or cancellation.
- Support partial usage/cost snapshots for failed or cancelled subagents.
- Throttle live updates so the UI does not rerender on every token/event.

## Non-Goals

- Do not change custom tools or future non-built-in subagents.
- Do not roll child subagent usage into the parent manager label.
- Do not invent a new usage format or a second billing convention.
- Do not add GitHub issue/PR reporting changes.

## Current Behavior

Relevant files:

- `src/core/subagent-rendering.ts` renders the subagent card title, collapsed preview, and final transcript output.
- `src/core/subagent.ts` runs isolated subagents and streams transcript events back to the tool layer.
- `src/core/transcript.ts` stores transcript entries and final transcript metadata, but not a live usage snapshot.
- `src/tools/finder.ts`, `src/tools/oracle.ts`, `src/tools/worker.ts`, and `src/tools/manager.ts` all use the shared subagent runner/rendering path.

Today, built-in subagent cards can show final transcript content and status, but they do not show a live Pi-style usage label on the card itself. The only usage-like display is limited to final result data in some contexts, not a continuously updated inline label.

## Desired Behavior

1. Every invocation of `finder`, `oracle`, `worker`, and `manager` renders a compact usage label on its own card.
2. The label updates live while the subagent runs, using a small throttle/debounce so the display feels live without repainting every token.
3. The label stays visible after the subagent completes, errors, aborts, or is cancelled.
4. The label reflects only that subagent invocation’s own usage/cost.
   - Example: if `manager` invokes five `finder` subagents, each `finder` card gets its own label.
   - The `manager` card shows only the manager subagent’s own usage/cost.
5. The label must match Pi’s native style, not a custom variant.
   - Preserve Pi’s compact formatting, rounding, and symbol order.
   - A representative shape is: `↑8.4k ↓2.2k $0.019 1.9%/272k`.
6. If a subagent fails or is cancelled after partial usage has accumulated, the card keeps the partial label instead of clearing it.
7. If a subagent ends before any usage snapshot is available, the card may remain unlabeled; it must not fabricate estimates.

## Acceptance Criteria

- [ ] Built-in subagent cards show a compact inline usage label while running.
- [ ] The label continues to show after completion, failure, or cancellation.
- [ ] The label updates with a short throttle/debounce rather than on every token/event.
- [ ] The label format matches Pi’s native usage style exactly enough to avoid a second convention.
- [ ] Each subagent invocation tracks only its own usage/cost; parent manager cards do not absorb child subagent totals.
- [ ] Partial usage/cost remains visible for failed or cancelled subagents.
- [ ] `finder`, `oracle`, `worker`, and `manager` all participate; other tools do not change.

## Edge Cases

- Provider streams that only emit usage at the end should still show the final label.
- A cancelled subagent with no usage snapshot should not show fake numbers.
- A manager chain/parallel run can emit many labels at once; each card must remain independently readable.
- Live updates must not cause flicker or repeated full-card resets.
- If usage data is temporarily missing for one update, the last known partial label should stay visible.

## Suggested Approach

- Extend the shared subagent transcript/state so each run can carry a live usage snapshot alongside status and transcript entries.
- Capture usage from the same events Pi already uses for assistant message accounting, then surface that snapshot through `runIsolatedSubagent` updates.
- Reuse or mirror Pi’s existing usage formatter so the label stays aligned with the host app.
- Render the label in the shared subagent card renderer so all built-in tools inherit the same behavior.
- Add a short debounce around UI invalidation/update emission to avoid repainting on every token.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Additional validation:

- Extend `tests/unit/subagent-rendering.test.ts` to cover the new label formatting/rendering behavior.
- Extend `tests/unit/subagent.test.ts` or `tests/unit/transcript.test.ts` to cover live usage propagation through the subagent runner/state.
- Manually run a built-in subagent in Pi and confirm:
  - the label appears while the subagent is running,
  - the label stays after finish/failure/cancel,
  - manager children each have their own labels,
  - the text matches Pi’s native usage style.

## Documentation Updates

- No user-facing docs update is required unless the implementation reveals a new limitation or a mismatch with Pi’s current native formatter.
- If implementation details need comments, keep them local to `src/core/subagent.ts`, `src/core/subagent-rendering.ts`, or related transcript helpers.

## Risks / Open Questions

- The exact live usage snapshot available from the agent event stream may differ by provider or transport.
- We need to avoid introducing a new label format while still making the inline card usable.
- Some providers may only expose final usage, which would make the label jump from blank to final instead of smoothly counting.
- UI throttling needs to balance responsiveness with terminal flicker.
