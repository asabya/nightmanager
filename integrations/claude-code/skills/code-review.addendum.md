## Claude Code integration note

On Claude Code the canonical review lenses ship **alongside this skill** as
`review-personas.md` in this skill's own directory. Use that co-located file as the
single source of truth for the shared review lenses and the Fowler code-smell
baseline — there is no `prompts/review-personas.md` in a Claude install. Paste the
co-located `review-personas.md` into the Standards sub-agent in full.

Spawn the two axes as parallel subagents using the native `oracle` subagent (or
`general-purpose`); the `oracle` subagent is read-only and well suited to review.
