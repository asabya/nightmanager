---
name: wayfinder
description: Plan a huge, foggy chunk of work — more than one agent session can hold — as a shared local map of investigation tickets, then resolve them one at a time until the way to the destination is clear.
---

# Wayfinder

A loose idea has arrived — too big for one agent session and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding charts that way as a **shared map**, then works its tickets one at a time until the route is clear. It is planning, not doing.

Nightmanager is local-file-first, so the map is a **local Markdown file**, not GitHub issues: `specs/map-<slug>.md`. Its tickets are entries inside that file.

## Plan, don't do

Each ticket resolves a decision, an investigation, or an unblocking task. The map is done when nothing is left to decide before someone goes and builds the thing. The pull to just start coding is usually the signal you've reached the edge of the map — hand off to `to-spec` / `to-tickets` then. Absent an explicit override in the map's Notes, produce decisions, not deliverables.

## The map file — `specs/map-<slug>.md`

The whole map at low resolution, loaded once per session.

```markdown
# Wayfinder Map: <name>

## Destination

<what reaching the end of this map looks like — the spec, decision, or change this effort finds its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; which skills each session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index — one line per resolved ticket: enough to judge relevance -->
- <resolved ticket title> — <one-line gist of the answer>

## Tickets

<!-- the frontier and the blocked. Work any ticket whose blockers are all [done]. -->
- [ ] <ticket title> — type: research | grilling | prototype | task
  - Blocked by: <titles, or "None">
  - Question: <the decision or investigation this ticket resolves, sized to one agent session>

## Not yet specified

<!-- in-scope fog you can't ticket yet; graduates into tickets as the frontier advances -->

## Out of scope

<!-- work consciously ruled beyond the destination; never graduates -->
```

A ticket is **unblocked** when every ticket blocking it is `[done]`. The **frontier** is the unblocked, unclaimed (`[ ]`, not `[in-progress]`) tickets. **Claim** a ticket by flipping it to `[in-progress]` before doing any work, so a parallel session skips it.

## Ticket types

Every ticket is either worked *with* a human (HITL) or by the agent alone (AFK). A HITL ticket never resolves by the agent answering its own questions.

- **research** (AFK): read primary sources via the `/research` skill (which dispatches `librarian`). Link the resulting `docs/research/<slug>.md` note. Use when knowledge outside the working directory is required.
- **grilling** (HITL): a `/grill-me` conversation, one question at a time. The default type.
- **prototype** (HITL): when "how should it look / behave" is the key question, a concrete artifact is needed. Nightmanager has **no prototype skill** — so emit this as a `task` the human does ad hoc (build a rough spike, react to it), and record the outcome as the answer. Do not attempt an automated prototype.
- **task** (HITL or AFK): manual work that must happen before a decision can be made — signing up for a service, provisioning access, moving data. The one type that *does* rather than decides, and it earns its place only by unblocking a decision. Record what was done and any facts later tickets depend on.

## Fog of war

Don't chart what you can't yet see. Beyond the live tickets is the fog — decisions you can tell are coming but can't yet phrase sharply because they hang on open questions. Write them loosely under **Not yet specified**. The test is whether you can *state* the question precisely now, not whether you can answer it. Ticket when sharp (even if blocked); leave in the fog when not. Resolving a ticket clears fog ahead of it — graduate whatever is now specifiable into fresh tickets, one at a time, until no tickets remain.

## Out of scope

The destination fixes the scope; work beyond it is out of scope — not fog. When a ticket turns out to sit past the destination, mark it `[done]` and leave one line in **Out of scope** explaining why. It never graduates.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session.**

### Chart the map

User invokes with a loose idea.

1. **Name the destination** via a `/grill-me` session — the spec, decision, or change this map finds its way to. Scope is settled first.
2. **Map the frontier** — grill again, breadth-first, fanning across the whole space to surface open decisions and first takeable steps. If this surfaces no fog (the way is already clear, small enough for one session), you don't need a map — stop and tell the user.
3. **Create `specs/map-<slug>.md`**: Destination and Notes filled, Decisions-so-far empty, the fog sketched into Not yet specified.
4. **Add the tickets you can specify now** with their blocking edges.
5. Stop — charting is one session's work; do not also resolve tickets.

### Work through the map

User invokes with a map slug/path. A ticket is optional — without one, you pick the next frontier ticket.

1. Load the map (low-res — don't re-derive resolved tickets).
2. Choose the ticket (the named one, else the first frontier ticket). **Claim it** → `[in-progress]`.
3. Resolve it — invoke the skill its type names (`/research`, `/grill-me`, etc.). If in doubt, `/grill-me`.
4. Record the resolution: mark the ticket `[done]`, append a one-line gist to **Decisions so far**, and link any asset (research note, spike).
5. Graduate any fog the answer made specifiable into new tickets; clear those patches from Not yet specified. If the answer reveals a ticket sits past the destination, rule it out of scope instead of resolving it on the route.

The user may run unblocked tickets in parallel sessions, so expect the map file to change under you — re-read before writing.
