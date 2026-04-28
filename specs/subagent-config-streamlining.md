# Streamline Subagent Model and Thinking Configuration

## Summary

Replace per-subagent model config files with one streamlined subagent configuration file that supports both model and thinking settings. Add an agent-friendly Markdown setup guide that makes it easy for a Pi agent or human to create the recommended config after installation.

## Problem

Current subagent configuration is split across one file per subagent:

- `~/.pi/agent/finder.json`
- `~/.pi/agent/oracle.json`
- `~/.pi/agent/worker.json`
- `~/.pi/agent/manager.json`

Each file only supports `model`. There is no `thinking` setting and no clear agent-friendly way to set the default subagent models after installation.

This project is new and does not need legacy config compatibility. We can replace the old shape with a single cleaner config.

## Goals

- Add a unified config file at `~/.pi/agent/nightmanager.json`.
- Support per-agent `model` and `thinking` settings.
- Use `thinking: "medium"` as the minimum/default thinking level for all nightmanager.
- Recommend cheaper/smaller models for `manager` and `finder`.
- Recommend higher-tier models for `worker`, especially `oracle`.
- Remove reliance on old per-agent config files.
- Add an agent-friendly Markdown setup file that a Pi agent can follow to create/update the config after installation.
- Document the new config format in `README.md`.

## Non-goals

- Supporting legacy `~/.pi/agent/{agent}.json` config files.
- Adding a full interactive installer.
- Hardcoding a required provider.
- Adding a fifth subagent.
- Setting any subagent to `thinking: "low"`.

## Proposed Config

Path:

```text
~/.pi/agent/nightmanager.json
```

Shape:

```json
{
  "agents": {
    "manager": {
      "model": "provider/cheap-or-small-model",
      "thinking": "medium"
    },
    "finder": {
      "model": "provider/cheap-or-small-model",
      "thinking": "medium"
    },
    "worker": {
      "model": "provider/strong-model",
      "thinking": "medium"
    },
    "oracle": {
      "model": "provider/best-reasoning-model",
      "thinking": "medium"
    }
  }
}
```

Recommended model policy:

- `manager`: small/cheap model; mostly routes and synthesizes.
- `finder`: small/cheap model; performs focused discovery with tools.
- `worker`: stronger model; edits code and verifies behavior.
- `oracle`: strongest reasoning model; handles ambiguity, root-cause analysis, and trade-offs.

## Agent-Friendly Setup Markdown

Add a setup guide at:

```text
docs/subagent-config-setup.md
```

The guide should be written so an agent can execute it safely. It should include:

1. The target path: `~/.pi/agent/nightmanager.json`.
2. A command to create the parent directory.
3. A command/template to write the JSON config.
4. Instructions to ask the human which provider/model IDs to use if unknown.
5. A rule to avoid `thinking: "low"`.
6. A validation step to inspect the final JSON.
7. A note that `manager` and `finder` should generally be cheaper than `worker` and `oracle`.

## Implementation Notes

- Replace `ToolConfig` with a unified subagent config type in `src/core/models.ts` or a new config module.
- Each subagent should resolve its config from `~/.pi/agent/nightmanager.json` by subagent name.
- If config is missing or malformed, fall back to the current Pi session model and default `thinking: "medium"` where supported.
- If an agent-specific model is invalid or not found in the model registry, fall back to the current Pi session model and surface enough diagnostic detail for debugging.
- Pi's `pi-agent-core` `Agent` type supports `thinkingLevel`; apply the resolved per-agent `thinking` value through that API when creating isolated nightmanager.

## Acceptance Criteria

- [ ] A unified config file at `~/.pi/agent/nightmanager.json` is the only documented subagent config path.
- [ ] `manager`, `finder`, `worker`, and `oracle` read model config from `agents.<name>.model`.
- [ ] `manager`, `finder`, `worker`, and `oracle` apply thinking config from `agents.<name>.thinking` via the `pi-agent-core` `Agent` `thinkingLevel` option.
- [ ] No new docs or examples set `thinking` to `low`.
- [ ] Missing config falls back to the current Pi session model safely.
- [ ] Malformed config does not crash subagent execution.
- [ ] Invalid model references fall back to the current Pi session model safely.
- [ ] Legacy per-agent config files are no longer documented or used.
- [ ] `docs/subagent-config-setup.md` gives agent-friendly setup instructions.
- [ ] `README.md` documents the new config format and the recommended cheap/strong model split.
- [ ] Tests cover unified config parsing, missing config fallback, malformed config fallback, invalid model fallback, and per-agent resolution.
- [ ] Validation passes:

```bash
npm run typecheck
npm test
npm run build
```

## Open Questions

- What exact model IDs should the default examples use? Prefer placeholders unless the project chooses provider-specific defaults.
