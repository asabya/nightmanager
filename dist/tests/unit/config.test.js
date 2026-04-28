import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadNightmanagerConfig, parseModelReference, resolveSubagentConfig, } from "../../src/core/models.js";
const tempDirs = [];
function tempConfig(content) {
    const dir = mkdtempSync(join(tmpdir(), "nightmanager-config-"));
    tempDirs.push(dir);
    const path = join(dir, "nightmanager.json");
    writeFileSync(path, content);
    return path;
}
function model(provider, name) {
    return { provider, name };
}
function ctxWithRegistry(found, sessionModel = model("session", "current")) {
    return {
        model: sessionModel,
        modelRegistry: {
            find: vi.fn().mockReturnValue(found),
        },
    };
}
afterEach(() => {
    for (const dir of tempDirs.splice(0))
        rmSync(dir, { recursive: true, force: true });
});
describe("subagent config", () => {
    it("parses provider/model references", () => {
        expect(parseModelReference("ollama/glm-5:cloud")).toEqual({ provider: "ollama", modelId: "glm-5:cloud" });
        expect(parseModelReference("openai/gpt/with/slashes")).toEqual({ provider: "openai", modelId: "gpt/with/slashes" });
        expect(parseModelReference("missing-provider")).toBeNull();
    });
    it("loads unified per-agent model and thinking config", () => {
        const path = tempConfig(JSON.stringify({
            agents: {
                finder: { model: "ollama/small", thinking: "medium" },
                oracle: { model: "openai/reasoning", thinking: "high" },
            },
        }));
        expect(loadNightmanagerConfig(path)).toEqual({
            agents: {
                finder: { model: "ollama/small", thinking: "medium" },
                oracle: { model: "openai/reasoning", thinking: "high" },
            },
        });
    });
    it("returns null for missing or malformed config", () => {
        expect(loadNightmanagerConfig(join(tmpdir(), "does-not-exist-nightmanager.json"))).toBeNull();
        expect(loadNightmanagerConfig(tempConfig("{"))).toBeNull();
    });
    it("falls back to session model and medium thinking when config is missing", () => {
        const sessionModel = model("session", "current");
        const ctx = ctxWithRegistry(undefined, sessionModel);
        expect(resolveSubagentConfig(ctx, "worker", null)).toMatchObject({
            model: sessionModel,
            thinkingLevel: "medium",
        });
    });
    it("falls back to session model when configured model is invalid", () => {
        const sessionModel = model("session", "current");
        const ctx = ctxWithRegistry(undefined, sessionModel);
        const resolved = resolveSubagentConfig(ctx, "oracle", {
            agents: { oracle: { model: "missing/model", thinking: "high" } },
        });
        expect(resolved.model).toBe(sessionModel);
        expect(resolved.thinkingLevel).toBe("high");
        expect(resolved.invalidModel).toBe(true);
        expect(ctx.modelRegistry.find).toHaveBeenCalledWith("missing", "model");
    });
    it("resolves each agent independently", () => {
        const finderModel = model("ollama", "cheap");
        const workerModel = model("openai", "strong");
        const ctx = ctxWithRegistry(undefined);
        vi.mocked(ctx.modelRegistry.find)
            .mockReturnValueOnce(finderModel)
            .mockReturnValueOnce(workerModel);
        const config = {
            agents: {
                finder: { model: "ollama/cheap", thinking: "medium" },
                worker: { model: "openai/strong", thinking: "xhigh" },
            },
        };
        expect(resolveSubagentConfig(ctx, "finder", config)).toMatchObject({ model: finderModel, thinkingLevel: "medium" });
        expect(resolveSubagentConfig(ctx, "worker", config)).toMatchObject({ model: workerModel, thinkingLevel: "xhigh" });
    });
    it("normalizes unsupported low thinking to medium", () => {
        const path = tempConfig(JSON.stringify({ agents: { manager: { model: "ollama/small", thinking: "low" } } }));
        expect(loadNightmanagerConfig(path)?.agents?.manager?.thinking).toBe("medium");
    });
});
//# sourceMappingURL=config.test.js.map