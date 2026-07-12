# Nightmanager for Claude Code

Run the Nightmanager workflow natively inside [Claude Code](https://code.claude.com)
using native subagents and skills. No Anthropic SDK, no API key of its own, and no
custom model runtime — Claude Code owns authentication, model access, tools,
permissions, context windows, and subagent execution. Nightmanager supplies only the
shared prompts, agent roles, and workflow skills.

## Install

```bash
npx nightmanager install claude
```

By default this installs at the **user level** (`~/.claude/`), so the agents and
skills are available in every project. Flags:

| Flag | Effect |
| --- | --- |
| `--user` | Install to `~/.claude/` (default). |
| `--project` | Install to `./.claude/` in the current repo (check into version control to share with a team). |
| `--dry-run` | Print what would be created/skipped without writing anything. |
| `--force` | Overwrite existing files (by default existing files are skipped, never clobbered). |

Existing files are never overwritten silently; re-running the installer skips files
that already exist unless you pass `--force`.

## What gets installed

```text
<~/.claude | ./.claude>/
  agents/
    finder.md          # read-only codebase search (Read, Grep, Glob, Bash; sonnet)
    oracle.md          # read-only diagnosis / trade-offs (Read, Grep, Glob, Bash; sonnet)
    librarian.md       # external research (Read, Grep, Glob, Bash, WebFetch, WebSearch; sonnet)
    worker.md          # implementation (Read, Grep, Glob, Edit, Write, Bash; opus)
    manager.md         # orchestration (Read, Grep, Glob, Agent; opus — delegates, never edits)
  skills/
    grill-me/  wayfinder/  research/  to-spec/  to-tickets/  to-ready/
    implement/  code-review/  tdd/  nightmanager/
```

The agent files are **generated** from the canonical role prompts in
`prompts/agents/*.md` (shared with the Pi runtime) — do not edit the installed
copies by hand; edit the canonical prompt and re-run `npm run generate`.

## Agent roles

| Role | Purpose | Edits files? |
| --- | --- | --- |
| **finder** | Locate files, patterns, usages, relationships, tests, conventions. | No |
| **oracle** | Investigate root causes, weigh trade-offs, recommend the safest action. | No |
| **librarian** | Research third-party libraries/upstream repos from primary sources. | No |
| **worker** | Apply a well-scoped, already-diagnosed change and verify it. | Yes |
| **manager** | Orchestrate the other four via nested subagents; assemble the handoff. | No |

Claude auto-delegates based on each agent's `description`. You can also invoke one
explicitly with `@agent-finder`, `@agent-worker`, etc.

## Skill invocation

Each installed skill is a slash command (`/grill-me`, `/to-spec`, `/nightmanager`, …)
and is also auto-selected by Claude when the task matches its description. The shared
workflow:

```text
grill-me / wayfinder → research → to-spec → to-tickets → to-ready
  → implement | nightmanager → code-review → PR review
```

The `/nightmanager` skill runs one autonomous batch: it selects an eligible TODO and
delegates implementation to the `manager` subagent.

## Update / reinstall

Re-run `npx nightmanager install claude` after upgrading the package. Pass `--force`
to overwrite the previously installed files with the new versions. Because the agent
files are generated, the authoritative source is always the canonical prompt.

## Limitations

- **Handoffs are prompt-enforced.** Claude follows the Manager→Worker handoff
  contract by instruction; the Pi runtime validates it programmatically.
- **Worker git-safety is prompt-enforced.** The Worker agent is told not to commit,
  push, reset, stash, or merge without authorization, but has `Bash` access; there is
  no hard block.
- **Manager delegation is prompt-enforced.** A subagent cannot restrict *which*
  named subagents it spawns via frontmatter, so Manager delegates to the five named
  roles by instruction.
- Behavior may differ slightly from the Pi runtime; the two transcript UIs are not
  identical.
- TODO claiming is not atomic across concurrent sessions.

## Uninstall

There is no uninstall command yet. Remove the installed files directly:

```bash
# user-level install
rm ~/.claude/agents/{finder,oracle,librarian,worker,manager}.md
rm -rf ~/.claude/skills/{grill-me,wayfinder,research,to-spec,to-tickets,to-ready,implement,code-review,tdd,nightmanager}

# project-level install
rm ./.claude/agents/{finder,oracle,librarian,worker,manager}.md
rm -rf ./.claude/skills/{grill-me,wayfinder,research,to-spec,to-tickets,to-ready,implement,code-review,tdd,nightmanager}
```

Only remove skill directories you did not author yourself.
