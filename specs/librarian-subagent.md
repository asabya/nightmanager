# Spec: Librarian subagent for evidence-backed OSS research

Status: active
Owner: human
Created: 2026-05-02

## Problem

Nightmanager currently has generic discovery/reasoning/implementation subagents (`finder`, `oracle`, `worker`, `manager`), but no dedicated subagent for open-source library research.

That makes library questions awkward because the current flow does not enforce:
- canonical upstream repo discovery
- multi-repo comparison
- tests/examples-first inspection
- strict source-code-vs-doc precedence
- permalink-backed evidence
- adaptive comparison output for multiple implementations

We need a Librarian subagent that specializes in external OSS codebases and answers with evidence instead of guesses.

## Goals

- Add a dedicated `Librarian` subagent for OSS/library research.
- Prefer external upstream source code first, then official docs only if code evidence is insufficient.
- Support `web_search` and `code_search` for repo/docs discovery and code examples.
- Search GitHub for the canonical upstream repo when the user does not name it.
- Clone discovered upstream repos into `/tmp` and inspect them locally.
- Compare multiple upstream repos when relevant, with adaptive output format.
- Use tests/examples before README/docs when inspecting a repo.
- Treat source code as authoritative over docs when they conflict.
- Require strict GitHub permalink evidence for claims.

## Non-Goals

- Do not replace `oracle` for generic reasoning/debugging.
- Do not add write/edit capabilities to Librarian.
- Do not search GitLab/Bitbucket or other hosts in this version.
- Do not guess when the canonical upstream repo is ambiguous.
- Do not add issue/PR automation or code modification behavior.
- Do not make docs the primary source when source code evidence exists.

## Current Behavior

Relevant files and behavior:

- `src/index.ts` registers `finder`, `oracle`, `worker`, and `manager` only.
- `src/core/models.ts` only knows those four subagent names.
- `src/tools/oracle.ts` already exposes generic `web_search` and `code_search` helpers through the Oracle subagent.
- `src/tools/finder.ts`, `src/tools/worker.ts`, and `src/tools/manager.ts` are local-codebase oriented and do not specialize in upstream OSS analysis.
- `README.md` describes the loop as using Finder, Oracle, Worker, and Manager, but not Librarian.

Today, there is no dedicated OSS-research subagent with repo-clone, multi-repo comparison, and permalink-centric evidence rules.

## Desired Behavior

1. A new `librarian` tool exists and is registered in the extension entrypoint.
2. Librarian is a read-only research subagent for external open-source codebases.
3. If the user names one or more remote repos, Librarian clones those repos into `/tmp` and analyzes the local clones.
4. If the user only names a library/package, Librarian searches GitHub for the canonical upstream repo.
5. If the repo is ambiguous, Librarian fails instead of guessing.
6. If no canonical upstream repo can be found, Librarian falls back to official docs only.
7. Librarian inspects tests and examples before README/docs.
8. Librarian prefers source code over docs when they conflict.
9. Librarian consults official docs only when source code evidence is insufficient.
10. Librarian uses `web_search` and `code_search` for discovery and examples.
11. Librarian compares multiple repos when relevant:
    - 2–3 repos by default
    - 4–5 repos if the user provides them
    - 6+ repos are split into batches
12. Librarian ranks findings by all of the following:
    - API correctness
    - closest match to the user’s question
    - most current implementation
    - best-documented example
13. Librarian prefers the latest default branch HEAD unless the user specifies a version.
14. If the user specifies a version, that version is preferred over HEAD.
15. Librarian includes direct quotes/snippets when available.
16. Librarian returns an adaptive format:
    - ranked bullets
    - comparison table
    - side-by-side repo summary
    - or another format better suited to the question
17. Every factual claim in the final answer must be backed by a strict GitHub permalink when source code evidence is used.
18. If evidence remains weak or ambiguous after reasonable inspection, Librarian states uncertainty and stops.

## Acceptance Criteria

- [ ] `librarian` is registered in `src/index.ts` and available as a public subagent.
- [ ] `src/core/models.ts` recognizes `librarian` as a configurable subagent.
- [ ] Librarian exposes `web_search` and `code_search` capabilities.
- [ ] Librarian can search GitHub for a canonical upstream repo when the user gives only a package/library name.
- [ ] Librarian fails on ambiguous upstream repo identification and does not guess.
- [ ] Librarian can analyze one repo or compare multiple repos, including 4–5 repo user-provided comparisons.
- [ ] Librarian splits 6+ repos into batches rather than processing all at once.
- [ ] Librarian prioritizes tests/examples over README/docs, and code over docs when they conflict.
- [ ] Librarian returns permalink-backed evidence for code claims.
- [ ] Librarian falls back to official docs only when code evidence is insufficient.

## Edge Cases

- No canonical upstream repo exists on GitHub.
- Multiple GitHub repos match the same library name.
- The user specifies a version and it conflicts with the latest HEAD behavior.
- Repos have no tests/examples, so Librarian must fall back to production source and then docs.
- Source code and docs disagree.
- More than five repos are supplied at once.
- The user asks for a broad comparison that is better expressed as a table than a ranked list.
- Direct code quotes are unavailable, but line-linked permalinks are available.
- A repo clone succeeds, but the relevant behavior is only visible in linked tests or examples.

## Suggested Approach

- Add `src/tools/librarian.ts` modeled after `src/tools/oracle.ts`, but with a Librarian-specific prompt and output rules.
- Reuse the existing `web_search` and `code_search` plumbing from Oracle instead of duplicating the external-search implementation if possible.
- Add Librarian to `src/index.ts` and `src/core/models.ts`.
- Give Librarian its own system prompt that encodes:
  - GitHub-first canonical repo discovery
  - tests/examples-first inspection
  - code-over-docs precedence
  - `/tmp` cloning
  - multi-repo batching and ranking
  - strict permalink evidence
- Keep the tool read-only and avoid write/edit permissions.
- Add tests that prove the tool is wired up and that the research policy matches the spec.

## Testing Plan

Minimum expected validation:

```bash
npm run typecheck
npm test
npm run build  # alias for typecheck; no dist output
```

Additional validation:

- Add or extend `tests/integration/subagent-tools.test.ts` to verify Librarian is registered and invokes the subagent runner with the expected tool set.
- Add unit coverage for any Librarian-specific prompt/validation logic.
- Confirm `src/core/models.ts` resolves Librarian config correctly.
- Manually exercise Librarian on:
  - a single named package
  - an ambiguous package name
  - a 2–3 repo comparison
  - a versioned question
  - a code-vs-doc conflict

## Documentation Updates

- `README.md`: add Librarian to the subagent/tool overview.
- `src/index.ts`: export/register the new tool.
- `src/core/models.ts`: update the list of supported subagents.
- Any user-facing docs that enumerate the available subagents or research capabilities.

## Risks / Open Questions

- The repo currently has Oracle-style web search/code search plumbing, but Librarian may need shared helper extraction to avoid duplicating that logic.
- GitHub search may not always identify the canonical upstream repo cleanly.
- Strict code-first behavior can leave some questions unresolved if upstream repos do not expose the behavior in tests/examples/source.
- It is still unclear whether any future Context7-style integration should be part of Librarian or remain separate; this spec does not require it.
