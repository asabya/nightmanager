# Subagents Package Conversion Design

Date: 2026-04-21
Status: Approved in conversation; written for review before implementation planning

## Summary

Convert the `subagents` repository from a flat pair of Pi extension files into a proper TypeScript package and Pi package with modular source layout, real tests, and one combined Pi extension entrypoint.

The package will contain four tools:
- `finder`
- `oracle`
- `manager`
- `worker`

The package should support both:
- source-first development via `pi -e ./index.ts`
- built runtime via `pi -e ./dist/index.js`

The design goal remains high token-cost to performance ratio, but now with package hygiene, testability, and publishable Pi package structure.

## Goals

- Convert repo into a proper TypeScript package
- Convert repo into a proper Pi package
- Use a modular `src/` layout instead of flat root extensions
- Expose one combined Pi extension entrypoint that registers all four tools
- Add real tests: unit, integration, and selective CLI E2E smoke tests
- Preserve lightweight prompt design and strict role boundaries
- Create a clean foundation for implementing `manager` and `worker`

## Non-Goals

- P2P or distributed orchestration
- Multi-entrypoint package design in v1
- Large persona prompt library
- Heavy snapshot-based UI testing
- Large end-to-end matrix against live external providers

## Recommended Approach

Use a balanced package conversion:
- proper package scaffolding
- modular source files
- one combined Pi entrypoint
- Vitest for tests
- SDK-first integration tests
- selective CLI smoke tests

This gives a strong balance of confidence, maintainability, and speed.

## Package Shape

Proposed structure:

```text
subagents/
  package.json
  tsconfig.json
  vitest.config.ts
  README.md
  index.ts
  src/
    index.ts
    tools/
      finder.ts
      oracle.ts
      manager.ts
      worker.ts
    core/
      models.ts
      prompts.ts
      progress.ts
      result.ts
      subagent.ts
      routing.ts
    types/
      shared.ts
  tests/
    unit/
    integration/
    e2e/
```

### File responsibilities

- `index.ts`
  - root dev shim for `pi -e ./index.ts`
  - re-export default from `src/index.ts`

- `src/index.ts`
  - combined Pi extension entrypoint
  - registers all four tools

- `src/tools/*`
  - one module per tool
  - exports reusable tool definitions

- `src/core/*`
  - shared testable logic
  - config/model resolution
  - prompt helpers
  - progress helpers
  - routing logic
  - isolated subagent execution helpers
  - result extraction/formatting

- `tests/*`
  - unit, integration, and E2E smoke coverage

## Packaging and Runtime Model

### Package metadata

The repo should include:
- `package.json`
- `"type": "module"`
- a Pi package manifest under `"pi"`

### Pi package manifest

Use a single combined extension entrypoint:

```json
{
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

### Runtime modes

#### Development mode

```bash
pi -e ./index.ts
```

#### Built mode

```bash
pi -e ./dist/index.js
```

### Build strategy

Compile TypeScript to `dist/`.

Requirements:
- ESM output
- source maps enabled
- suitable `rootDir` / `outDir`
- built files usable both for tests and packaged runtime

### Exports

A minimal export surface is preferred.

Suggested shape:

```json
{
  "exports": {
    ".": "./dist/src/index.js"
  }
}
```

If needed, selective internal exports can be added later, but should not be required for v1.

### Dependencies

Use:
- `dependencies` for actual runtime dependencies
- `peerDependencies` for Pi framework packages
- `devDependencies` for TypeScript/testing/build tooling

Expected peer dependencies:
- `@mariozechner/pi-ai`
- `@mariozechner/pi-agent-core`
- `@mariozechner/pi-coding-agent`
- `@mariozechner/pi-tui`
- `@sinclair/typebox`

### Scripts

Expected scripts:
- `build`
- `test`
- `test:unit`
- `test:integration`
- `test:e2e`
- `typecheck`

Optionally:
- `dev:pi`

## Tool Architecture

### Combined entrypoint

`src/index.ts` should register all four tools:
- `finder`
- `oracle`
- `manager`
- `worker`

### Tool modules

#### `src/tools/finder.ts`
Responsible for:
- finder schema
- finder prompt
- finder-specific progress behavior
- finder tool definition export

#### `src/tools/oracle.ts`
Responsible for:
- oracle schema
- oracle prompt
- oracle-specific progress behavior
- oracle tool definition export

#### `src/tools/worker.ts`
Responsible for:
- worker schema
- worker prompt
- worker tool definition
- single-use finder fallback policy

#### `src/tools/manager.ts`
Responsible for:
- manager schema
- manager prompt
- manager tool definition
- single-delegate routing policy

### Shared core modules

#### `src/core/models.ts`
- config file loading/parsing
- session-model fallback logic
- model reference resolution

#### `src/core/subagent.ts`
- generic isolated `Agent` execution helper
- auth resolution
- timeout wiring
- final message extraction
- shared error-handling pattern

#### `src/core/prompts.ts`
- shared prompt fragments where beneficial
- keep prompts lightweight and role-specific

#### `src/core/routing.ts`
- task-shape classification
- delegate selection logic
- ambiguity handling policy

#### `src/core/result.ts`
- structured result formatting
- final text extraction helpers

#### `src/core/progress.ts`
- compact shared progress helpers
- avoid duplicated widget logic across tools

### Architectural rule

Tools should remain thin wrappers around shared, testable primitives.

## Role Boundaries

These boundaries remain unchanged from the earlier subagent design.

### Finder
- search and codebase exploration
- read-heavy evidence gathering
- no repository mutation

### Oracle
- deep reasoning
- debugging and root-cause analysis
- trade-off-aware planning
- no implementation work

### Manager
- read-only routing/orchestration
- classify task shape
- delegate to one best-fit tool by default
- no file edits
- no automatic multi-agent chains in v1

### Worker
- focused implementation
- smallest viable diffs
- verification-first
- may use `finder` once if blocked by codebase uncertainty
- no `oracle`
- no recursive delegation

## Test Strategy

The package should include three test layers.

### 1. Unit tests

Fast, deterministic tests for pure or nearly pure logic.

Primary targets:
- `src/core/routing.ts`
- `src/core/models.ts`
- `src/core/result.ts`
- selected prompt/helper logic in `src/core/prompts.ts`

Examples:
- classify `search | reasoning | implementation | ambiguous`
- resolve model config correctly
- enforce single-delegate and single-fallback guards
- format result structures correctly

These should be the bulk of the test suite.

### 2. Light integration tests

Use the Pi SDK in-process.

Purpose:
- verify tool definitions register correctly
- verify combined entrypoint registers all tools
- verify manager delegation behavior
- verify worker bounded finder fallback behavior
- verify isolated subagent tool composition

These tests should prefer stubs/mocks over live external provider behavior.

### 3. Selective E2E smoke tests

Use the `pi` CLI.

Purpose:
- verify `pi -e ./index.ts`
- verify `pi -e ./dist/index.js`
- verify the combined package entrypoint loads without runtime breakage

These should remain a small smoke suite, not a full end-to-end matrix.

## Test Philosophy

### Strongly test
- package/module boundaries
- routing logic
- delegation guards
- config parsing
- entrypoint loading
- role separation rules

### Do not over-index on
- exact prompt prose
- fragile TUI snapshots
- live network/provider behavior

This keeps the suite durable and fast.

## Tooling

Use:
- Vitest for unit and integration tests
- a small child-process helper for CLI smoke tests
- optional fixtures under `tests/fixtures/`

Likely layout:

```text
tests/
  unit/
    routing.test.ts
    models.test.ts
    result.test.ts
  integration/
    entrypoint.test.ts
    manager.test.ts
    worker.test.ts
  e2e/
    cli-smoke.test.ts
```

## Migration Plan

The repo already has working `finder.ts` and `oracle.ts`, so migration should be incremental.

### Phase 1: package scaffolding
- add `package.json`
- add `tsconfig.json`
- add `vitest.config.ts`
- add scripts
- create `src/` and `tests/`

### Phase 2: migrate existing finder/oracle
- move current logic into `src/tools/finder.ts` and `src/tools/oracle.ts`
- add `index.ts` and `src/index.ts`
- keep behavior stable while modularizing

### Phase 3: add tests around migrated finder/oracle internals
- config parsing
- reusable helper behavior
- combined extension registration

### Phase 4: implement manager/worker in new structure
- implement using modular architecture
- add unit and integration coverage alongside code

### Phase 5: CLI smoke and package validation
- validate source entrypoint
- validate build output
- validate package metadata and Pi manifest

## Migration Rule

Do not try to perfect the final architecture before migration.

Instead:
1. scaffold package
2. migrate working code
3. extract shared logic where repetition is obvious
4. implement manager/worker in the new structure

This keeps risk manageable.

## Risks and Mitigations

### Risk: migration breaks existing finder/oracle behavior
Mitigation:
- migrate incrementally
- add integration coverage before adding manager/worker
- keep prompts/behavior stable during migration

### Risk: tests become too brittle
Mitigation:
- focus on routing, config parsing, and registration behavior
- keep E2E suite small
- avoid snapshot-heavy UI assertions

### Risk: package setup becomes over-engineered
Mitigation:
- keep public API surface small
- use one entrypoint only
- avoid adding multiple package modes in v1

## Spec Self-Review

### Placeholder scan
No TODO/TBD placeholders remain.

### Internal consistency
The package structure, runtime model, tool modularization, and test strategy are aligned with the chosen direction: one combined Pi package entrypoint with modular internals and real tests.

### Scope check
This is a focused package-conversion-plus-implementation foundation, not a broad platform rewrite.

### Ambiguity check
The main intentionally deferred area is how much shared logic gets extracted during migration. The migration rule makes that explicit: extract only where repetition becomes clear.

## Final Recommendation

Proceed with a package-first migration to a real TypeScript and Pi package, add unit/integration/selective E2E tests, then implement `manager` and `worker` on top of that modular structure rather than extending the current flat repo layout.