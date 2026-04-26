# Spec: File-Based Subagent Handoffs

Status: ready
Owner: human
Created: 2026-04-26

## Problem

Manager-to-worker handoffs are currently assembled as in-memory structured data and then flattened into the worker task text. This makes it hard to answer operational questions such as:

- Did a handoff actually happen?
- What exact objective, findings, files, decisions, constraints, risks, and verification commands were handed to Worker?
- Can a failed Night Shift run be inspected after the fact without relying on the chat transcript?

Night Shift needs a reviewable, file-based handoff trail so humans can verify that delegation worked and so future debugging can compare the manager plan against worker execution.

## Goals

- Persist each Worker handoff to a local file before Worker execution.
- Include enough structured data in the file to audit handoff quality and diagnose failures.
- Make Worker consume or reference that file so the persisted handoff is the canonical handoff source for the run.
- Keep the feature local-only and safe for repository use.
- Add tests that prove handoff files are created and the Worker task references them.
- Document how to inspect handoff files during or after Night Shift.

## Non-Goals

- Do not build a full run database, dashboard, or analytics system.
- Do not persist every finder/oracle response unless it is included in the worker handoff.
- Do not change the public purpose of finder, oracle, worker, or manager.
- Do not commit generated handoff files.
- Do not require external services.

## Current Behavior

Relevant files identified during Day Shift discovery:

- `src/core/handoff.ts` defines `handoffSchema` and `formatWorkerTask`.
- `src/tools/manager.ts` exposes the internal `handoff_to_worker` tool, validates required handoff fields, and delegates to Worker.
- `src/tools/worker.ts` formats the direct task plus optional handoff and calls `runIsolatedSubagent`.
- `src/core/subagent.ts` runs isolated subagents with a task string.
- `tests/unit/handoff.test.ts` covers current handoff formatting.
- `tests/integration/subagent-tools.test.ts` covers handoff flow through subagent tools.
- `tests/integration/manager.test.ts` covers manager prompt/tool registration.
- `tests/unit/subagent.test.ts` covers isolated subagent execution.

Today the handoff is a structured object only while inside the current tool call. It is rendered into text and passed as a task string; there is no durable file path for human inspection.

## Desired Behavior

When Worker is invoked with handoff context, the system should create a handoff artifact file before Worker execution. The artifact should be readable by humans and machines.

Suggested artifact format:

```json
{
  "version": 1,
  "createdAt": "2026-04-26T00:00:00.000Z",
  "subagent": "worker",
  "source": "manager" | "direct-worker",
  "objective": "...",
  "handoff": {
    "findings": [],
    "targetFiles": [],
    "relatedFiles": [],
    "decisions": [],
    "constraints": [],
    "risks": [],
    "verification": {},
    "evidence": [],
    "rawContext": "..."
  },
  "taskPreview": "short human-readable task summary"
}
```

Default storage location should be local and gitignored, for example:

```text
.pi/handoffs/<timestamp>-worker-handoff.json
```

The exact filename may include a timestamp and short random suffix to avoid collisions.

Worker should receive a task that clearly says a handoff artifact was written and gives the file path. Prefer making the file content the canonical context by instructing Worker to read the handoff file before acting. If the current subagent API only accepts task strings, the task string may include both the path and the existing formatted summary, but the file must still be produced and referenced.

Generated handoff files must not be committed. `.gitignore` should ignore the handoff artifact directory if it does not already.

## Acceptance Criteria

- [ ] Invoking Worker with a non-empty handoff writes a JSON handoff artifact to a local file.
- [ ] The artifact includes objective, findings, target files, decisions, constraints, risks, verification guidance, evidence, raw context when provided, creation time, version, and source metadata.
- [ ] The Worker task text references the handoff artifact path and instructs Worker to read/use it.
- [ ] Existing direct Worker calls without handoff continue to work.
- [ ] Manager's `handoff_to_worker` path produces a handoff artifact before Worker execution.
- [ ] Handoff artifact directory is ignored by git.
- [ ] Tests cover artifact creation, task/path inclusion, and backwards compatibility for no-handoff Worker execution.
- [ ] Documentation explains where handoff files are written and how humans can inspect them to verify handoffs are working.

## Edge Cases

- Multiple handoffs in the same second must not overwrite each other.
- Handoff file creation failure should fail clearly before Worker executes, not silently drop the audit trail.
- Paths should be stable enough for logs and tests but should not rely on machine-specific absolute paths in snapshots.
- Handoff data may contain long findings or raw context; preserve content without truncating the JSON artifact.
- Optional handoff fields should be omitted or represented consistently when empty.
- Direct Worker calls with only `task` and no `handoff` should not create confusing empty artifacts unless the implementation intentionally documents that behavior.

## Suggested Approach

1. Add a helper in `src/core/handoff.ts` or a new small module such as `src/core/handoff-artifact.ts`:
   - validate/normalize handoff data using the existing schema,
   - create `.pi/handoffs/` if needed,
   - write pretty-printed JSON,
   - return the artifact path and metadata.
2. Update Worker execution in `src/tools/worker.ts` so that when `input.handoff` is present:
   - it writes the artifact,
   - then calls `formatWorkerTask` with an artifact path/reference or prepends a clear instruction to the formatted task.
3. Preserve `formatWorkerTask` behavior for callers/tests that only need text formatting, or extend it in a backwards-compatible way with optional artifact metadata.
4. Ensure Manager's `handoff_to_worker` path benefits automatically because it already delegates to `workerTool.execute` with handoff data.
5. Update `.gitignore` for `.pi/handoffs/` if needed.
6. Add unit tests for artifact writing and formatting changes.
7. Add/update integration tests that spy on isolated subagent execution and assert the task references the artifact path.
8. Update `README.md` and/or `docs/nightshift.md` with a short “Inspecting handoffs” section.

Rejected alternative: only logging the handoff to stdout. Logs are harder to locate after a long run and do not give Night Shift a durable file contract.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build
```

Narrow tests to run first:

```bash
npm run test:unit -- tests/unit/handoff.test.ts tests/unit/subagent.test.ts
npm run test:integration -- tests/integration/subagent-tools.test.ts tests/integration/manager.test.ts
```

Manual check:

1. Invoke Worker or Manager with a small handoff.
2. Confirm `.pi/handoffs/` contains a new JSON file.
3. Confirm the JSON includes the expected objective/findings/target files/decisions.
4. Confirm `git status --short` does not show generated handoff files.

## Documentation Updates

- `README.md`: mention file-based handoff artifacts in the delegation model or Worker/Manager sections.
- `docs/nightshift.md`: add operational guidance for checking `.pi/handoffs/` after a Night Shift run.
- `.gitignore`: ignore generated handoff artifacts.

## Risks / Open Questions

- Should handoff files be retained indefinitely or should there be a cleanup policy? For this spec, retain them and document manual deletion.
- Should artifacts live under `.pi/handoffs/` or a temp directory? Prefer `.pi/handoffs/` for reviewability, with gitignore protection.
- If Pi subagents cannot directly read local files from task instructions, the artifact still serves as audit evidence; keep the formatted text fallback until file reading is proven reliable.
