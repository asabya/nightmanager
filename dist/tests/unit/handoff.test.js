import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatWorkerTask, readHandoffArtifact, writeHandoffArtifact } from "../../src/core/handoff.js";
describe("handoff", () => {
    // Override the handoffs directory for tests
    let testHandoffsDir;
    beforeAll(async () => {
        testHandoffsDir = await mkdtemp(join(tmpdir(), "handoff-test-"));
    });
    afterAll(async () => {
        // Clean up test directory
        try {
            await rm(testHandoffsDir, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    });
    it("returns the plain task when no handoff context is provided", () => {
        expect(formatWorkerTask({ task: "Fix the failing test" })).toBe("Fix the failing test");
    });
    it("formats structured worker handoff context", () => {
        const task = formatWorkerTask({
            task: "Fix expired token handling",
            handoff: {
                objective: "Return TOKEN_EXPIRED for expired tokens.",
                findings: ["Finder found token handling in src/auth/middleware.ts."],
                targetFiles: ["src/auth/middleware.ts"],
                relatedFiles: ["tests/auth/middleware.test.ts"],
                decisions: ["Oracle recommends preserving ExpiredTokenError."],
                constraints: ["Smallest viable change."],
                risks: ["Do not alter malformed token behavior."],
                verification: {
                    suggestedCommands: ["npm test -- tests/auth/middleware.test.ts"],
                    rationale: "Narrowest existing auth middleware test.",
                },
                evidence: [
                    {
                        source: "finder",
                        file: "src/auth/middleware.ts",
                        line: 42,
                        note: "Token errors are mapped here.",
                    },
                ],
            },
        });
        expect(task).toContain("Handoff context:");
        expect(task).toContain("Target files:");
        expect(task).toContain("src/auth/middleware.ts");
        expect(task).toContain("Oracle recommends preserving ExpiredTokenError.");
        expect(task).toContain("npm test -- tests/auth/middleware.test.ts");
        expect(task).toContain("Do not repeat broad discovery already covered by finder/oracle");
    });
    it("includes artifact path in task when provided", () => {
        const task = formatWorkerTask({
            task: "Fix the issue",
            handoff: {
                objective: "Fix the bug",
                findings: ["Found the bug"],
                targetFiles: ["src/bug.ts"],
                decisions: ["Fixed the bug"],
            },
        }, "/tmp/handoffs/artifact.json");
        expect(task).toContain("Handoff file:");
        expect(task).toContain("/tmp/handoffs/artifact.json");
        expect(task).toContain("Please read this artifact file first to get the full handoff context.");
    });
    it("writes handoff artifact to file with all required fields", async () => {
        const input = {
            task: "Fix token expiration bug",
            handoff: {
                objective: "Return TOKEN_EXPIRED when token is expired",
                findings: ["Token expiration checked in middleware.ts"],
                targetFiles: ["src/auth/middleware.ts"],
                relatedFiles: ["tests/auth/middleware.test.ts"],
                decisions: ["Preserve existing error handling"],
                constraints: ["Smallest change possible"],
                risks: ["None identified"],
                verification: {
                    suggestedCommands: ["npm test -- tests/auth"],
                    rationale: "Run existing auth tests",
                },
                evidence: [
                    {
                        source: "finder",
                        file: "src/auth/middleware.ts",
                        line: 42,
                        note: "Token expiration check here",
                    },
                ],
                rawContext: "User reported expired tokens not handled",
            },
        };
        const filepath = await writeHandoffArtifact(input, "manager");
        const content = await readFile(filepath, "utf-8");
        const artifact = JSON.parse(content);
        expect(artifact.version).toBe(1);
        expect(artifact.createdAt).toBeDefined();
        expect(artifact.subagent).toBe("worker");
        expect(artifact.source).toBe("manager");
        expect(artifact.objective).toBe("Return TOKEN_EXPIRED when token is expired");
        expect(artifact.taskPreview).toBe("Fix token expiration bug");
        expect(artifact.handoff.findings).toEqual(["Token expiration checked in middleware.ts"]);
        expect(artifact.handoff.targetFiles).toEqual(["src/auth/middleware.ts"]);
        expect(artifact.handoff.decisions).toEqual(["Preserve existing error handling"]);
        expect(artifact.handoff.constraints).toEqual(["Smallest change possible"]);
        expect(artifact.handoff.risks).toEqual(["None identified"]);
        expect(artifact.handoff.verification.suggestedCommands).toEqual(["npm test -- tests/auth"]);
        expect(artifact.handoff.verification.rationale).toBe("Run existing auth tests");
        expect(artifact.handoff.evidence).toHaveLength(1);
        expect(artifact.handoff.evidence[0].source).toBe("finder");
        expect(artifact.handoff.evidence[0].file).toBe("src/auth/middleware.ts");
        expect(artifact.handoff.evidence[0].line).toBe(42);
        expect(artifact.handoff.rawContext).toBe("User reported expired tokens not handled");
    });
    it("assigns direct-worker as source when called directly", async () => {
        const input = {
            task: "Quick fix",
            handoff: {
                objective: "Quick fix",
                findings: ["Found issue"],
                targetFiles: ["src/file.ts"],
                decisions: ["Fixed"],
            },
        };
        const filepath = await writeHandoffArtifact(input, "direct-worker");
        const content = await readFile(filepath, "utf-8");
        const artifact = JSON.parse(content);
        expect(artifact.source).toBe("direct-worker");
    });
    it("handles missing optional handoff fields gracefully", async () => {
        const input = {
            task: "Simple task",
        };
        const filepath = await writeHandoffArtifact(input, "direct-worker");
        const content = await readFile(filepath, "utf-8");
        const artifact = JSON.parse(content);
        // Missing handoff object uses task as objective
        expect(artifact.objective).toBe("Simple task");
        expect(artifact.handoff.findings).toEqual([]);
        expect(artifact.handoff.targetFiles).toEqual([]);
        expect(artifact.handoff.decisions).toEqual([]);
    });
    it("can read back a written handoff artifact", async () => {
        const input = {
            task: "Test task",
            handoff: {
                objective: "Test objective",
                findings: ["Finding 1", "Finding 2"],
                targetFiles: ["file1.ts", "file2.ts"],
                decisions: ["Decision 1"],
            },
        };
        const filepath = await writeHandoffArtifact(input, "manager");
        const artifact = await readHandoffArtifact(filepath);
        expect(artifact.objective).toBe("Test objective");
        expect(artifact.handoff.findings).toHaveLength(2);
        expect(artifact.handoff.decisions[0]).toBe("Decision 1");
    });
    it("generates unique filenames to avoid collisions", async () => {
        const input = { task: "Test" };
        // Write multiple artifacts quickly
        const paths = await Promise.all([
            writeHandoffArtifact(input, "direct-worker"),
            writeHandoffArtifact(input, "direct-worker"),
            writeHandoffArtifact(input, "direct-worker"),
        ]);
        // All paths should be unique
        expect(new Set(paths).size).toBe(3);
    });
    it("backwards compatible: task without handoff context works", () => {
        // Direct calls without handoff should not create artifact reference
        const task = formatWorkerTask({ task: "Simple task" });
        expect(task).toBe("Simple task");
    });
});
//# sourceMappingURL=handoff.test.js.map