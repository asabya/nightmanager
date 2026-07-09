---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown note in the repo. Dispatches Nightmanager's librarian tool so you keep working while it reads.
---

# Research

Answer a question from **primary sources** and leave a durable note behind.

Nightmanager already has a research engine — the **`librarian`** tool (OSS research, upstream code evidence, GitHub permalinks). This skill is a thin wrapper: it dispatches `librarian` to do the reading so the main session keeps working, then lands the findings as a Markdown file.

## Process

1. **Dispatch `librarian`** with the question. Instruct it to:
   - Investigate against primary sources — official docs, source code, specs, first-party APIs — not secondary write-ups. Follow every claim back to the source that owns it.
   - Prefer upstream code evidence with GitHub permalinks where the question is about a dependency or OSS behaviour (this is what `librarian` is best at).
   - Return findings with a citation for each claim.

2. **Write the findings to `docs/research/<slug>.md`** — one Markdown file, each claim citing its source (URL or permalink). If `docs/research/` does not exist yet, create it; that is Nightmanager's convention for research notes. If the repo clearly keeps such notes elsewhere, match that instead and say where you put it.

3. **Report** the note's path and a short summary so the finding can feed a `to-spec`, a ticket, or a Wayfinder map ticket.

Keep the note factual and sourced — it is reference material for later planning, not a decision. Decisions still go through `grill-me` / `to-spec`.
