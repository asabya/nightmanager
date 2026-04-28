# Subagent Config Setup

Use `/nightconfig` to create or update the unified Pi subagent config interactively. Use this guide for manual setup.

## Target

```text
~/.pi/agent/nightmanager.json
```

This is the only subagent config file used by this package. If it is missing or invalid, nightmanager fall back to the current Pi session model and `thinking: "medium"`.

## Interactive setup

Run `/nightconfig` to configure all subagents, or `/nightconfig worker` to update only one subagent. The command validates models against Pi's available model list, rejects `thinking: "low"`, creates the target file when missing, and preserves unrelated JSON keys.

## Manual steps

1. Ask the human which provider/model IDs to use if you do not already know them.
   - `manager` and `finder` should generally use cheaper or smaller models.
   - `worker` should use a stronger code-editing model.
   - `oracle` should use the strongest reasoning model available.
   - Do not set any subagent to `thinking: "low"`.

2. Create the parent directory:

   ```bash
   mkdir -p ~/.pi/agent
   ```

3. Write the config, replacing placeholders with real `provider/model-id` values:

   ```bash
   cat > ~/.pi/agent/nightmanager.json <<'JSON'
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
         "thinking": "high"
       }
     }
   }
   JSON
   ```

4. Validate the final JSON:

   ```bash
   python -m json.tool ~/.pi/agent/nightmanager.json
   ```

5. Inspect the result and confirm it contains only the intended model IDs and no `thinking: "low"` values:

   ```bash
   cat ~/.pi/agent/nightmanager.json
   ```

## Notes

- Supported `thinking` values documented here are `medium`, `high`, and `xhigh`; use `medium` unless a model/provider benefits from more reasoning.
- If a configured model reference is not found by Pi, the subagent uses the current Pi session model instead.
