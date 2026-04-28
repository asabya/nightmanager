---
name: to-prd
description: Turn a rough idea into a draft local spec in specs/ using this repository's existing spec template and Nightmanager conventions.
---

# To PRD

Turn the current idea, plan, or conversation into a draft spec file under `specs/` using the structure from `specs/TEMPLATE.md`.

Follow these rules:

- Ask clarifying questions when requirements are underspecified; do not guess.
- Inspect existing repo context when it can clarify current behavior or likely implementation areas.
- Write a `specs/draft-<slug>.md` file unless the user requests a specific filename.
- Preserve the template sections and fill them with concrete, testable content.
- Keep the output local-file-first; do not create TODOs or GitHub issues as the primary output.
- If the user asks for a TODO candidate, add it as `[draft]` only unless they explicitly approve `[ready]`.
