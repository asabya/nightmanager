---
name: to-prd
description: Turn a rough idea into a draft local spec in Specs/ using this repository's existing spec template and Night Shift conventions.
---

# To PRD

Turn the current idea, plan, or conversation into a draft spec file under `Specs/` using the structure from `Specs/TEMPLATE.md`.

Follow these rules:

- Ask clarifying questions when requirements are underspecified; do not guess.
- Inspect existing repo context when it can clarify current behavior or likely implementation areas.
- Write a `Specs/draft-<slug>.md` file unless the user requests a specific filename.
- Preserve the template sections and fill them with concrete, testable content.
- Keep the output local-file-first; do not create TODOs or GitHub issues as the primary output.
- If the user asks for a TODO candidate, add it as `[draft]` only unless they explicitly approve `[ready]`.
