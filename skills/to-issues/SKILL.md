---
name: to-issues
description: Break a spec or plan into local TODOs.md entries by default, using vertically sliced Nightmanager-compatible tasks.
---

# To Issues

Convert an existing spec, plan, or conversation into actionable local `TODOs.md` entries using this repository's existing TODO format.

Follow these rules:

- Default to editing local `TODOs.md`; do not create GitHub issues unless the user explicitly requests GitHub issues.
- Preserve Nightmanager compatibility: use the existing queue format, status tags, priority tags, spec references, acceptance criteria, validation, and notes style.
- Prefer `[draft]` entries unless the user explicitly approves `[ready]`.
- Split large work into multiple vertical slices that each deliver independently useful behavior across the stack.
- Avoid horizontal layer-only tasks unless they are genuinely standalone.
- Keep each TODO small enough for one focused implementation pass with clear validation commands.
- Do not modify unrelated TODO entries.
