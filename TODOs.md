# TODOs

Nightmanager implementation queue.

## Status Tags

- `[bug]` — eligible; highest priority defect.
- `[ready]` — eligible for autonomous implementation.
- `[draft]` — not eligible; still being planned. Created by Day Shift planner or human. Human must promote it to `[ready]` before Nightmanager can pick it up.
- `[blocked]` — not eligible until the reason is resolved.
- `[in-progress]` — currently being worked.
- `[done]` — complete; include commit hash when available.

## Queue

- [done] Add `/nightconfig` extension command to manage `~/.pi/agent/nightmanager.json`
  - Spec: `specs/nightconfig-command.md`
  - Scope: add the new Pi slash command in the extension, prompt for one or all subagents, validate model IDs via Pi’s model list, reject `thinking: "low"`, and update/create only `agents.*.model` and `agents.*.thinking`.
  - Acceptance:
    - `/nightconfig` prompts for all four agents.
    - `/nightconfig worker` updates only worker and preserves the other agents.
    - Unknown model IDs are rejected.
    - `thinking: "low"` is rejected.
    - Missing config file is created.
  - Validation:
    - `npm run typecheck`
    - `npm test`
    - `npm run build`
