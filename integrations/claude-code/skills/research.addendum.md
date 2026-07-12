## Claude Code integration note

On Claude Code, delegate the actual investigation to the native **`librarian`**
subagent (via the Agent tool) rather than a Pi `librarian` tool. The Librarian
subagent is read-only, prefers primary sources, and cites commit-pinned permalinks.
Write the findings to `docs/research/<slug>.md` as usual.
