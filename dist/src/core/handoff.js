import { Type } from "@sinclair/typebox";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
export const handoffSourceSchema = Type.Union([
    Type.Literal("user"),
    Type.Literal("finder"),
    Type.Literal("oracle"),
    Type.Literal("manager"),
]);
export const nonEmptyStringArraySchema = (description) => Type.Array(Type.String(), { minItems: 1, description });
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
const HANDOFFS_DIR = join(homedir(), ".pi", "handoffs");
function hasItems(items) {
    return Array.isArray(items) && items.length > 0;
}
/**
 * Generate a unique filename to avoid collisions when multiple handoffs happen in the same second
 */
function generateArtifactFilename() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const random = Math.random().toString(36).slice(2, 6);
    return `${timestamp}-${random}-worker-handoff.json`;
}
/**
 * Create the handoffs directory if it doesn't exist
 */
async function ensureHandoffsDir() {
    try {
        await mkdir(HANDOFFS_DIR, { recursive: true });
    }
    catch (error) {
        if (error.code !== "EEXIST")
            throw error;
    }
}
/**
 * Write a handoff artifact to a JSON file in the handoffs directory
 * @returns The absolute path to the created artifact file
 */
export async function writeHandoffArtifact(input, source) {
    await ensureHandoffsDir();
    const artifact = {
        version: 1,
        createdAt: new Date().toISOString(),
        subagent: "worker",
        source,
        objective: input.handoff?.objective ?? input.task,
        taskPreview: input.task.slice(0, 200),
        handoff: {
            findings: input.handoff?.findings ?? [],
            targetFiles: input.handoff?.targetFiles ?? input.targetFiles ?? [],
            relatedFiles: input.handoff?.relatedFiles ?? [],
            decisions: input.handoff?.decisions ?? [],
            constraints: input.handoff?.constraints ?? input.constraints ?? [],
            risks: input.handoff?.risks ?? [],
            verification: {
                suggestedCommands: input.handoff?.verification?.suggestedCommands ?? input.verification,
                rationale: input.handoff?.verification?.rationale,
            },
            evidence: input.handoff?.evidence ?? [],
            rawContext: input.handoff?.rawContext ?? input.context,
        },
    };
    const filename = generateArtifactFilename();
    const filepath = join(HANDOFFS_DIR, filename);
    await writeFile(filepath, JSON.stringify(artifact, null, 2), "utf-8");
    return filepath;
}
/**
 * Read a handoff artifact from a JSON file
 */
export async function readHandoffArtifact(filepath) {
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content);
}
function pushList(lines, title, items) {
    if (!hasItems(items))
        return;
    lines.push(`${title}:`);
    for (const item of items)
        lines.push(`- ${item}`);
    lines.push("");
}
function formatEvidence(evidence) {
    const location = evidence.file
        ? `${evidence.file}${evidence.line ? `:${evidence.line}` : ""}`
        : evidence.command
            ? `command: ${evidence.command}`
            : evidence.url
                ? evidence.url
                : evidence.source;
    return `[${evidence.source}] ${location} — ${evidence.note}`;
}
/**
 * Format a worker task for execution. When a handoff artifact path is provided,
 * includes instructions for reading the artifact file.
 */
export function formatWorkerTask(input, artifactPath) {
    const handoff = input.handoff;
    const lines = [
        "Implementation task:",
        input.task.trim(),
        "",
    ];
    const hasHandoff = Boolean(handoff ||
        input.context?.trim() ||
        hasItems(input.targetFiles) ||
        hasItems(input.constraints) ||
        hasItems(input.verification));
    if (!hasHandoff)
        return input.task;
    // If artifact path provided, include instructions to read it
    if (artifactPath) {
        lines.push("Handoff file:", `A structured handoff artifact has been written to: ${artifactPath}`, "Please read this artifact file first to get the full handoff context.", "");
    }
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
        for (const evidence of handoff.evidence)
            lines.push(`- ${formatEvidence(evidence)}`);
        lines.push("");
    }
    lines.push("Worker handoff instructions:", "- Use this handoff as the starting map.", "- Read target files before editing to verify the handoff is still accurate.", "- Do not repeat broad discovery already covered by finder/oracle unless the handoff is missing, stale, or contradictory.", "- Use finder only if blocked by missing codebase context.");
    return lines.join("\n").trimEnd();
}
//# sourceMappingURL=handoff.js.map