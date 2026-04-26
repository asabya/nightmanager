Read `AGENTS.md`, `AGENT_LOOP.md`, and `TODOs.md`.

Run exactly one Night Shift cycle:

1. Select one eligible TODO from `TODOs.md` (`[bug]` first, then `[ready]`). Ignore `[draft]`, `[blocked]`, `[in-progress]`, and `[done]`.
2. Load the linked spec and relevant docs. Ignore specs whose basename starts with `draft-`.
3. Delegate implementation to the `manager` tool with a self-contained handoff. The manager should use finder/oracle/worker as needed.
4. Require tests/docs/validation appropriate to the TODO, including:

```bash
npm run typecheck
npm test
npm run build
```

5. Update `TODOs.md` to `[done]` with commit hash, or `[blocked]` with a concise reason.
6. Commit exactly one completed TODO. Do not implement multiple TODOs in this run.
7. End with a concise report: selected TODO, commit or blocked reason, files changed, validations run, and follow-ups.

Do not ask for live steering. If the TODO/spec is ambiguous or unsafe, block it with an explanation instead of guessing.
