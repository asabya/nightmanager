import { type Static } from "@sinclair/typebox";
export declare const handoffSourceSchema: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"user">, import("@sinclair/typebox").TLiteral<"finder">, import("@sinclair/typebox").TLiteral<"oracle">, import("@sinclair/typebox").TLiteral<"manager">]>;
export declare const nonEmptyStringArraySchema: (description: string) => import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>;
export declare const handoffEvidenceSchema: import("@sinclair/typebox").TObject<{
    source: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"user">, import("@sinclair/typebox").TLiteral<"finder">, import("@sinclair/typebox").TLiteral<"oracle">, import("@sinclair/typebox").TLiteral<"manager">]>;
    file: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    line: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
    command: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    url: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    note: import("@sinclair/typebox").TString;
}>;
export declare const handoffVerificationSchema: import("@sinclair/typebox").TObject<{
    suggestedCommands: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    rationale: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
export declare const handoffSchema: import("@sinclair/typebox").TObject<{
    objective: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    findings: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    targetFiles: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    relatedFiles: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    decisions: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    constraints: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    risks: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    verification: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TObject<{
        suggestedCommands: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
        rationale: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    }>>;
    evidence: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        source: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"user">, import("@sinclair/typebox").TLiteral<"finder">, import("@sinclair/typebox").TLiteral<"oracle">, import("@sinclair/typebox").TLiteral<"manager">]>;
        file: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        line: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TInteger>;
        command: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        url: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        note: import("@sinclair/typebox").TString;
    }>>>;
    rawContext: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
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
/**
 * Handoff artifact written to file system for auditability
 */
export interface WorkerHandoffArtifact {
    version: number;
    createdAt: string;
    subagent: "worker";
    source: "manager" | "direct-worker";
    objective: string;
    taskPreview: string;
    handoff: {
        findings: string[];
        targetFiles: string[];
        relatedFiles: string[];
        decisions: string[];
        constraints: string[];
        risks: string[];
        verification: {
            suggestedCommands?: string[];
            rationale?: string;
        };
        evidence: Array<{
            source: HandoffSource;
            file?: string;
            line?: number;
            command?: string;
            url?: string;
            note: string;
        }>;
        rawContext?: string;
    };
}
/**
 * Write a handoff artifact to a JSON file in the handoffs directory
 * @returns The absolute path to the created artifact file
 */
export declare function writeHandoffArtifact(input: WorkerHandoffInput, source: "manager" | "direct-worker"): Promise<string>;
/**
 * Read a handoff artifact from a JSON file
 */
export declare function readHandoffArtifact(filepath: string): Promise<WorkerHandoffArtifact>;
/**
 * Format a worker task for execution. When a handoff artifact path is provided,
 * includes instructions for reading the artifact file.
 */
export declare function formatWorkerTask(input: WorkerHandoffInput, artifactPath?: string): string;
