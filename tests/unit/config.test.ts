import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";
import {
  loadSubagentsConfig,
  parseModelReference,
  resolveSubagentConfig,
} from "../../src/core/models.js";

const tempDirs: string[] = [];

function tempConfig(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "subagents-config-"));
  tempDirs.push(dir);
  const path = join(dir, "subagents.json");
  writeFileSync(path, content);
  return path;
}

function model(provider: string, name: string): Model<any> {
  return { provider, name } as Model<any>;
}

function ctxWithRegistry(found?: Model<any>, sessionModel: Model<any> | undefined = model("session", "current")): ExtensionContext {
  return {
    model: sessionModel,
    modelRegistry: {
      find: vi.fn().mockReturnValue(found),
    },
  } as unknown as ExtensionContext;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
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

    expect(loadSubagentsConfig(path)).toEqual({
      agents: {
        finder: { model: "ollama/small", thinking: "medium" },
        oracle: { model: "openai/reasoning", thinking: "high" },
      },
    });
  });

  it("returns null for missing or malformed config", () => {
    expect(loadSubagentsConfig(join(tmpdir(), "does-not-exist-subagents.json"))).toBeNull();
    expect(loadSubagentsConfig(tempConfig("{"))).toBeNull();
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
        finder: { model: "ollama/cheap", thinking: "medium" as const },
        worker: { model: "openai/strong", thinking: "xhigh" as const },
      },
    };

    expect(resolveSubagentConfig(ctx, "finder", config)).toMatchObject({ model: finderModel, thinkingLevel: "medium" });
    expect(resolveSubagentConfig(ctx, "worker", config)).toMatchObject({ model: workerModel, thinkingLevel: "xhigh" });
  });

  it("normalizes unsupported low thinking to medium", () => {
    const path = tempConfig(JSON.stringify({ agents: { manager: { model: "ollama/small", thinking: "low" } } }));
    expect(loadSubagentsConfig(path)?.agents?.manager?.thinking).toBe("medium");
  });
});
