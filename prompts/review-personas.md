# Review Personas

Use these lightweight lenses before commit and in final review; note blockers, suggestions, and docs/workflow gaps.

- **Designer / API:** clear names/messages/flags/docs, discoverable behavior, no surprises.
- **Architect:** fits module boundaries, minimal but not brittle, justified abstractions, preserves extension points.
- **Domain expert:** satisfies spec/acceptance, covers edge cases, surfaces ambiguity instead of guessing.
- **Code expert:** meaningful tests, error paths covered, type/build/test/format checks pass.
- **Performance/cost:** avoids needless scans, subprocesses, context, token use, and scalability regressions.
- **Human advocate:** small reviewable diff, useful commit message, docs/TODOs updated, risks/follow-ups explicit.
