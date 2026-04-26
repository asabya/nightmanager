import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MANAGER_SYSTEM_PROMPT } from "../../src/core/prompts.js";
describe("manager tool", () => {
    it("is registered by the combined entrypoint", () => {
        const source = readFileSync("src/index.ts", "utf-8");
        expect(source).toContain("managerTool");
    });
    it("is prompted as a multi-step orchestrator", () => {
        expect(MANAGER_SYSTEM_PROMPT).toContain("orchestration subagent");
        expect(MANAGER_SYSTEM_PROMPT).toContain("finder first");
        expect(MANAGER_SYSTEM_PROMPT).toContain("call oracle first");
        expect(MANAGER_SYSTEM_PROMPT).toContain("call handoff_to_worker");
        expect(MANAGER_SYSTEM_PROMPT).toContain("Never call worker directly");
        expect(MANAGER_SYSTEM_PROMPT).toContain("handoff.targetFiles");
    });
    it("records delegate call metadata", () => {
        const source = readFileSync("src/tools/manager.ts", "utf-8");
        expect(source).toContain("delegateCalls");
        expect(source).toContain("status: \"running\"");
        expect(source).toContain("summary?: string");
        expect(source).toContain("handoff_to_worker");
        expect(source).toContain("invalid_worker_handoff");
        expect(source).toContain("trackDelegation(handoffToWorkerTool)");
        expect(source).not.toContain("trackDelegation(workerTool)");
        expect(source).toContain("timeoutMs: 600_000");
    });
});
//# sourceMappingURL=manager.test.js.map