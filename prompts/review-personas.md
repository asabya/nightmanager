# Review Personas

Canonical review criteria for Nightmanager. The foreground `/code-review` skill and the night-shift cycle (`prompts/nightmanager.md`) both draw from this file — keep it the single source of truth; when the night shift embeds a copy, mirror any change here into that copy.

Review runs along **two independent axes**. A change can pass one and fail the other — right thing built the wrong way, or wrong thing built cleanly — so report them separately and never merge or re-rank across them.

## Axis 1 — Standards (does the code follow how this repo writes code?)

Apply the persona lenses, plus the code-smell baseline below.

- **Designer / API:** clear names/messages/flags/docs, discoverable behavior, no surprises.
- **Architect:** fits module boundaries, minimal but not brittle, justified abstractions, preserves extension points.
- **Code expert:** meaningful tests, error paths covered, type/build/test/format checks pass.
- **Performance/cost:** avoids needless scans, subprocesses, context, token use, and scalability regressions.
- **Human advocate:** small reviewable diff, useful commit message, docs/TODOs updated, risks/follow-ups explicit.

### Code-smell baseline (Fowler, _Refactoring_ ch.3)

Applies even when the repo documents no standards. Two rules bind it: a documented repo standard always **overrides** the baseline; and every smell is a **judgement call** ("possible Feature Envy"), never a hard violation — skip anything tooling already enforces. Each reads *what it is* → *how to fix*:

- **Mysterious Name** — a name that doesn't reveal what it does or holds. → rename; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape in more than one place in the change. → extract it, call from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move it onto the data it envies.
- **Data Clumps** — the same few fields/params keep travelling together. → bundle them into one type.
- **Primitive Obsession** — a primitive/string standing in for a domain concept. → give the concept its own small type.
- **Repeated Switches** — the same switch/if-cascade on the same type recurs. → replace with polymorphism or one shared map.
- **Shotgun Surgery** — one logical change forces scattered edits across many files. → gather what changes together into one module.
- **Divergent Change** — one module edited for several unrelated reasons. → split so each changes for one reason.
- **Speculative Generality** — abstraction/params/hooks for needs the spec doesn't have. → delete; inline until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method.
- **Middle Man** — a class/function that mostly just delegates. → cut it, call the real target direct.
- **Refused Bequest** — a subclass/implementer that ignores most of what it inherits. → drop inheritance, use composition.

## Axis 2 — Spec (does the code implement what was asked?)

Against the originating spec / ticket, report:

- **Domain expert:** requirements satisfied vs. missing or partial; edge cases from Acceptance Criteria covered; ambiguity surfaced instead of guessed.
- Behaviour in the diff that was **not** asked for (scope creep).
- Requirements that look implemented but implemented **wrong**. Quote the spec/acceptance line for each finding.

If there is no spec (e.g. a spec-less `[bug]`), skip this axis and say so.
