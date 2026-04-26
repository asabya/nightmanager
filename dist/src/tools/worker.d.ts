export declare const workerTool: import("@mariozechner/pi-coding-agent").ToolDefinition<import("@sinclair/typebox").TObject<{
    task: import("@sinclair/typebox").TString;
    handoff: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TObject<{
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
    }>>;
    context: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    targetFiles: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    constraints: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    verification: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    _source: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"manager">, import("@sinclair/typebox").TLiteral<"direct-worker">]>>;
}>, unknown, any> & import("@mariozechner/pi-coding-agent").ToolDefinition<any, any, any>;
