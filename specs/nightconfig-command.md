# Spec: `/nightconfig` command

Status: ready
Owner: <human>
Created: 2026-04-28

## Problem

Users currently have to set up Nightmanager configuration manually, which is not friendly. We want a single Pi slash command that can create and maintain `~/.pi/agent/nightmanager.json` by prompting for subagent model choices and thinking levels.

## Goals

- Add a Pi slash command `/nightconfig` in the extension.
- Let users configure one subagent or all subagents from the same command.
- Prompt for a model ID and thinking level per subagent.
- Validate chosen model IDs against Pi’s available models (`pi --list-models`).
- Reject unknown model IDs.
- Enforce that no subagent uses `thinking: "low"`.
- Create `~/.pi/agent/nightmanager.json` if it does not exist.
- Preserve unrelated JSON keys when updating the config.
- Update only `agents.*.model` and `agents.*.thinking`.

## Non-Goals

- Installing the extension or skills.
- Editing any files outside `~/.pi/agent/nightmanager.json`.
- Supporting model selection outside Pi’s model list.
- Allowing `thinking: "low"`.
- Changing any other config fields besides `agents.*.model` and `agents.*.thinking`.

## Current Behavior

The package currently exposes an extension via `index.ts` and ships skills through `package.json` `pi.skills`. There is no `/nightconfig` command today. The config guide in `docs/subagent-config-setup.md` describes the target file as `~/.pi/agent/nightmanager.json` and says nightmanager should fall back to the current Pi session model and `thinking: "medium"` when config is missing or invalid.

## Desired Behavior

- The extension registers a new slash command `/nightconfig` from a new file, exported through the existing `index.ts` entrypoint.
- Command usage:
  - `/nightconfig` prompts for all four subagents: `manager`, `finder`, `worker`, `oracle`.
  - `/nightconfig worker` updates only the `worker` entry and leaves the other three unchanged.
- For each configured subagent, the command prompts for:
  - model ID
  - thinking level
- Recommended thinking levels should be shown in the prompt flow:
  - `manager`: medium
  - `finder`: medium
  - `worker`: high or xhigh
  - `oracle`: high
- The command must validate model IDs against Pi’s current model list and reject unknown IDs before writing config.
- The command must reject `thinking: "low"`.
- On success, the command writes a valid JSON file at `~/.pi/agent/nightmanager.json`, creating the parent directory if needed.
- If the file already exists, the command updates only `agents.<subagent>.model` and `agents.<subagent>.thinking` for the selected subagent(s), preserving other top-level keys and other agent entries.
- If the file does not exist, the command creates the minimal config structure with the selected agent entries.

## Acceptance Criteria

- [ ] `/nightconfig` exists as a registered Pi slash command.
- [ ] `/nightconfig worker` updates only the worker agent and preserves the other agents.
- [ ] Unknown model IDs are rejected using Pi’s model list.
- [ ] `thinking: "low"` is rejected.
- [ ] The command creates `~/.pi/agent/nightmanager.json` when missing.
- [ ] The command only mutates `agents.*.model` and `agents.*.thinking`.

## Edge Cases

- Existing config is missing some agent entries.
- Existing config is invalid JSON.
- Current Pi model list changes between prompt and save.
- User enters a model ID that exists but is not currently available in the active Pi session.
- User updates one subagent multiple times.
- User provides a config file with extra unrelated keys that must be preserved.

## Suggested Approach

- Implement the command in a new extension module and export it from `index.ts`.
- Read the current model list from Pi before validating user input.
- Parse and rewrite the config JSON carefully so unrelated keys survive.
- Keep validation and write logic isolated so future commands can reuse it.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build
```

Add command-level tests for:
- creating a new config
- updating one agent only
- rejecting unknown models
- rejecting `thinking: "low"`

## Documentation Updates

- `docs/subagent-config-setup.md`
- `README.md` or package docs describing `/nightconfig`
- Any extension/command docs that mention available slash commands

## Risks / Open Questions

- The exact Pi API for reading `pi --list-models` from an extension needs confirmation.
- The command flow for prompting may need a custom UI if model selection is not available through standard input widgets.
- The config file schema may need defensive handling if users already have partial or malformed JSON.
