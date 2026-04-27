# Review Personas

Use these personas as lightweight review lenses before and after implementation. Each persona should identify blocking issues, non-blocking suggestions, and documentation/workflow gaps.

## 1. Designer / API Ergonomics

- Is the feature easy to understand and use?
- Are names, messages, CLI flags, and docs consistent?
- Does the change avoid surprising behavior?
- For inbuilt skills, are skill names, descriptions, and invocation behavior discoverable after package install?

## 2. Architect / Maintainability

- Does the design fit existing module boundaries?
- Is the implementation minimal without being brittle?
- Are abstractions introduced only when justified?
- Does the change preserve future extension points?
- For packaged skills, is discovery declared through package metadata/files without adding custom setup paths?

## 3. Domain Expert / Correctness

- Does the implementation satisfy the spec and acceptance criteria?
- Are edge cases covered?
- Are ambiguous requirements surfaced instead of guessed?
- For planning skills, do generated specs/TODOs preserve local-file-first Night Shift conventions and avoid GitHub issues unless explicitly requested?

## 4. Code Expert / Tests and Reliability

- Are tests meaningful and appropriately scoped?
- Do tests fail before the fix when practical?
- Are error paths covered?
- Are type checks, builds, and test commands passing?

## 5. Performance Expert / Cost and Scalability

- Does the implementation avoid unnecessary work, large context usage, repeated scans, and expensive subprocesses?
- Are long-running commands bounded or justified?
- Could the change degrade interactive performance?

## 6. Human Advocate / Reviewability

- Is the diff small enough to review?
- Is the commit message useful to a human reviewer?
- Are docs/TODOs/changelog updated when needed?
- Are risks and follow-ups explicit?
