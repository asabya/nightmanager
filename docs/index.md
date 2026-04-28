# Pi The Nightmanager

A high-performance TypeScript extension for the Pi coding agent that bundles four specialized subagent tools. Each subagent has a focused role, lightweight prompts, and isolated context—optimized for strong token-cost to performance ratio.

---

## Hero

Pi The Nightmanager transforms Pi into a multi-specialist team:

- **Finder** — codebase search and exploration
- **Oracle** — reasoning, debugging, and root-cause analysis  
- **Worker** — focused implementation with minimal diffs
- **Manager** — orchestration across the right specialists

Install once, delegate intelligently.

---

## Tools Overview

| Tool | Role | Best For | Config |
|------|------|---------|--------|
| **finder** | Codebase search | Finding where features live, tracing module connections | `~/.pi/agent/subagents.json` |
| **oracle** | Reasoning & debugging | Ambiguous failures, root-cause analysis, trade-off planning | `~/.pi/agent/subagents.json` |
| **worker** | Implementation | Smallest viable fix, verified changes | `~/.pi/agent/subagents.json` |
| **manager** | Orchestration | Coordinating finder/oracle/worker workflows | `~/.pi/agent/subagents.json` |

Model selection follows a fallback chain: unified subagent config → current Pi session model.

---

## Quick Start

### Install

```bash
# Local package install
pi install /absolute/path/to/nightmanager
```

### Run

```bash
# Development (from source)
pi -e ./index.ts

# Production (built)
npm run build
pi -e ./dist/index.js
```

### Use a Tool

```text
Use finder to find where authentication is handled
```

```text
Use oracle to debug why auth middleware fails intermittently
```

```text
Use worker to make the smallest possible fix and verify it
```

```text
Use manager to investigate the failing auth flow, choose the safest fix, implement it, and verify the result
```

---

## When to Use Which Tool

### Use Finder When...
- You need to locate implementation details
- You're tracing how modules connect
- You want a map of a codebase flow
- You're asking "where does X happen?"

### Use Oracle When...
- You encounter ambiguous or intermittent failures
- You need root-cause analysis
- You're weighing architectural trade-offs
- You're deciding the best next probe

### Use Worker When...
- You have a clear implementation task
- You want the smallest viable change
- You need verified results
- You want focused execution, not discussion

### Use Manager When...
- A task spans discovery, reasoning, and implementation
- You want a workflow such as `finder -> oracle -> worker`
- The code area is unfamiliar and needs mapping before edits
- A bug needs diagnosis before a safe fix

---

## Configuration

All four tools support a unified optional config file at `~/.pi/agent/subagents.json`:

```json
{
  "agents": {
    "manager": { "model": "provider/cheap-or-small-model", "thinking": "medium" },
    "finder": { "model": "provider/cheap-or-small-model", "thinking": "medium" },
    "worker": { "model": "provider/strong-model", "thinking": "medium" },
    "oracle": { "model": "provider/best-reasoning-model", "thinking": "high" }
  }
}
```

Config precedence: unified subagent config → Pi session model. Missing or malformed config falls back safely; `thinking` defaults to `medium`. Keep `manager` and `finder` cheaper than `worker` and `oracle` when possible. See [subagent-config-setup.md](subagent-config-setup.md) for a safe setup procedure.

### Package Scripts

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type check without build
npm run test       # Run full test suite
npm run test:unit  # Unit tests only
```

---

## Architecture

```
nightmanager/
├── index.ts          # Combined Pi extension entrypoint
├── src/
│   ├── index.ts      # Internal exports
│   ├── tools/        # Tool implementations (finder, oracle, worker, manager)
│   ├── core/         # Shared utilities
│   └── types/        # Type definitions
├── tests/
│   ├── unit/         # Unit tests
│   ├── integration/  # Integration tests
│   └── e2e/          # End-to-end tests
```

### Delegation Model

- **finder** — standalone exploration; returns handoff-friendly target files and implementation context
- **oracle** — standalone reasoning; returns handoff-friendly recommendations, risks, and verification guidance
- **worker** — may use structured handoff context, may use finder once if blocked; no oracle calls, no recursion
- **manager** — orchestrates finder/oracle/worker workflows as needed; does not inspect or edit files directly

Each subagent maintains isolated context for token efficiency. Cross-subagent context is passed explicitly through worker handoff fields such as findings, target files, decisions, constraints, risks, and suggested verification. Manager cannot call Worker directly; implementation is hard-gated through `handoff_to_worker`, which requires non-empty objective, findings, target files, and decisions.

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

### Testing Layers

- **Unit** (`npm run test:unit`) — isolated function tests
- **Integration** (`npm run test:integration`) — tool interaction tests
- **E2E** (`npm run test:e2e`) — CLI smoke tests

---

## Learn More

- **Specifications**: See [superpowers/specs/](superpowers/specs/)
- **Implementation plans**: See [superpowers/plans/](superpowers/plans/)
- **Issues**: Report bugs and feature requests via GitHub Issues

---

## License

MIT License — see the `license` field in `package.json`.
