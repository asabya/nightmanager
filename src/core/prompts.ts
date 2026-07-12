import { MANAGER_CANONICAL, WORKER_CANONICAL } from "../shared/generated-prompts.js";

export const BASE_PROMPT = "Return concise, evidence-backed results.";

export const LEAN_RESPONSE_INSTRUCTIONS = `Response: be direct, brief, evidence-first. Do not narrate routine tool use. Use short bullets. If blocked, name the missing input and next action.`;

// Pi-specific mechanics composed around the canonical Worker body. The canonical
// body owns the substantive role behavior; this layer carries Pi tool constraints.
const PI_WORKER_MECHANICS = `Pi mechanics: use finder at most once if codebase context is missing; do not call oracle or delegate recursively.`;

export const WORKER_SYSTEM_PROMPT = [WORKER_CANONICAL, PI_WORKER_MECHANICS, LEAN_RESPONSE_INSTRUCTIONS].join("\n\n");

// Pi-specific mechanics composed around the canonical Manager body. This maps the
// host-neutral roles onto Pi's actual delegation tools (finder/oracle/librarian +
// handoff_to_worker) and carries the substrings the manager tests assert.
const PI_MANAGER_MECHANICS = `Pi mechanics: you are an orchestration subagent; delegate through tools and never edit files directly.
Tool policy:
- Simple search -> finder.
- Simple reasoning/debugging -> oracle.
- External/upstream/dependency research -> librarian.
- Clear implementation with context -> call handoff_to_worker.
- Unfamiliar implementation -> call finder first, then call handoff_to_worker.
- Ambiguous failure + requested fix -> call oracle first; if the action is concrete, call handoff_to_worker.
- Ambiguous/unsafe intent -> ask one clarifying question.
Constraints:
- Never call worker directly; use handoff_to_worker.
- handoff_to_worker requires handoff.objective, findings, handoff.targetFiles, and decisions.
- Preserve delegate evidence, target files, root cause, risks, constraints, and verification in the handoff.
- Do not repeat delegated work. Keep summaries short and evidence-backed.`;

export const MANAGER_SYSTEM_PROMPT = [MANAGER_CANONICAL, PI_MANAGER_MECHANICS, LEAN_RESPONSE_INSTRUCTIONS].join("\n\n");
