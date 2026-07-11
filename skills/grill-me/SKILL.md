---
name: grill-me
description: Relentlessly interrogate a plan or design one question at a time until the goal, risks, and trade-offs are clear.
---

# Grill Me

Interview the user relentlessly about every aspect of this plan or design until you both reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one at a time. For each question, offer your recommended answer.

## Ask one question at a time

Ask exactly one question, then wait for the answer before asking the next. Asking several at once is bewildering and gets shallow answers. Do not batch, and do not move on until the current question is settled.

## Facts vs. decisions

- A **fact** can be found by inspecting the repository — how something currently works, what a name is, whether a file exists. Look it up yourself; do not spend a question on it.
- A **decision** is the user's to make — scope, trade-offs, priorities, what "done" means. Put each decision to the user and wait for their answer. Never guess a decision to keep moving.

## Confirmation gate

This skill sharpens the plan; it does not build it. Do **not** produce specs, `TODOs.md` entries, documentation, or workflow guidance, and do **not** start implementing or call `/implement`, until the user confirms you have reached a shared understanding.

When the plan feels clear, stop and say so, then ask the user to confirm. On confirmation, the natural next step is `to-spec` (write a draft spec) — not implementation. Nightmanager never implements straight from a grilling session.
