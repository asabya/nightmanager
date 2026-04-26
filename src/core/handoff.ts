import { Type, type Static } from "@sinclair/typebox";

export const handoffSourceSchema = Type.Union([
  Type.Literal("user"),
  Type.Literal("finder"),
  Type.Literal("oracle"),
  Type.Literal("manager"),
]);

export const nonEmptyStringArraySchema = (description: string) => Type.Array(
  Type.String(),
  { minItems: 1, description },
);

export const handoffEvidenceSchema = Type.Object({
  source: handoffSourceSchema,
  file: Type.Optional(Type.String({ description: "Relevant local file path, preferably absolute when known" })),
  line: Type.Optional(Type.Integer({ minimum: 1, description: "Relevant 1-indexed line number" })),
  command: Type.Optional(Type.String({ description: "Command that produced the evidence" })),
  url: Type.Optional(Type.String({ description: "External evidence URL" })),
  note: Type.String({ description: "Concise evidence note" }),
});

export const handoffVerificationSchema = Type.Object({
  suggestedCommands: Type.Optional(Type.Array(Type.String(), { description: "Verification commands to run after implementation" })),
  rationale: Type.Optional(Type.String({ description: "Why these commands are relevant" })),
});

export const handoffSchema = Type.Object({
  objective: Type.Optional(Type.String({ description: "Implementation objective distilled from prior work" })),
  findings: Type.Optional(Type.Array(Type.String(), { description: "Key findings from finder/user context" })),
  targetFiles: Type.Optional(Type.Array(Type.String(), { description: "Primary files worker should inspect or edit" })),
  relatedFiles: Type.Optional(Type.Array(Type.String(), { description: "Additional files useful for context or tests" })),
  decisions: Type.Optional(Type.Array(Type.String(), { description: "Reasoning conclusions or implementation decisions" })),
  constraints: Type.Optional(Type.Array(Type.String(), { description: "Constraints worker must preserve" })),
  risks: Type.Optional(Type.Array(Type.String(), { description: "Known risks or edge cases" })),
  verification: Type.Optional(handoffVerificationSchema),
  evidence: Type.Optional(Type.Array(handoffEvidenceSchema)),
  rawContext: Type.Optional(Type.String({ description: "Additional concise handoff context" })),
});

export type HandoffSource = Static<typeof handoffSourceSchema>;
export type HandoffEvidence = Static<typeof handoffEvidenceSchema>;
export type HandoffVerification = Static<typeof handoffVerificationSchema>;
export type SubagentHandoff = Static<typeof handoffSchema>;

export interface WorkerHandoffInput {
  task: string;
  handoff?: SubagentHandoff;
  context?: string;
  targetFiles?: string[];
  constraints?: string[];
  verification?: string[];
}

function hasItems(items: string[] | undefined): items is string[] {
  return Array.isArray(items) && items.length > 0;
}

function pushList(lines: string[], title: string, items: string[] | undefined): void {
  if (!hasItems(items)) return;
  lines.push(`${title}:`);
  for (const item of items) lines.push(`- ${item}`);
  lines.push("");
}

function formatEvidence(evidence: HandoffEvidence): string {
  const location = evidence.file
    ? `${evidence.file}${evidence.line ? `:${evidence.line}` : ""}`
    : evidence.command
      ? `command: ${evidence.command}`
      : evidence.url
        ? evidence.url
        : evidence.source;
  return `[${evidence.source}] ${location} — ${evidence.note}`;
}

export function formatWorkerTask(input: WorkerHandoffInput): string {
  const handoff = input.handoff;
  const lines: string[] = [
    "Implementation task:",
    input.task.trim(),
    "",
  ];

  const hasHandoff = Boolean(
    handoff ||
    input.context?.trim() ||
    hasItems(input.targetFiles) ||
    hasItems(input.constraints) ||
    hasItems(input.verification)
  );

  if (!hasHandoff) return input.task;

  lines.push("Handoff context:");
  if (handoff?.objective?.trim()) {
    lines.push("Objective:", handoff.objective.trim(), "");
  }
  if (input.context?.trim()) {
    lines.push("Caller context:", input.context.trim(), "");
  }
  if (handoff?.rawContext?.trim()) {
    lines.push("Raw handoff context:", handoff.rawContext.trim(), "");
  }

  pushList(lines, "Findings", handoff?.findings);
  pushList(lines, "Target files", [...(handoff?.targetFiles ?? []), ...(input.targetFiles ?? [])]);
  pushList(lines, "Related files", handoff?.relatedFiles);
  pushList(lines, "Decisions", handoff?.decisions);
  pushList(lines, "Constraints", [...(handoff?.constraints ?? []), ...(input.constraints ?? [])]);
  pushList(lines, "Risks", handoff?.risks);

  const suggestedCommands = [
    ...(handoff?.verification?.suggestedCommands ?? []),
    ...(input.verification ?? []),
  ];
  pushList(lines, "Suggested verification", suggestedCommands);
  if (handoff?.verification?.rationale?.trim()) {
    lines.push("Verification rationale:", handoff.verification.rationale.trim(), "");
  }

  if (handoff?.evidence?.length) {
    lines.push("Evidence:");
    for (const evidence of handoff.evidence) lines.push(`- ${formatEvidence(evidence)}`);
    lines.push("");
  }

  lines.push(
    "Worker handoff instructions:",
    "- Use this handoff as the starting map.",
    "- Read target files before editing to verify the handoff is still accurate.",
    "- Do not repeat broad discovery already covered by finder/oracle unless the handoff is missing, stale, or contradictory.",
    "- Use finder only if blocked by missing codebase context.",
  );

  return lines.join("\n").trimEnd();
}
