import { describe, expect, it } from "vitest";
import { parseModelReference } from "../../src/core/models.js";

describe("models", () => {
  it("parses provider/model references", () => {
    expect(parseModelReference("ollama/glm-5:cloud")).toEqual({ provider: "ollama", modelId: "glm-5:cloud" });
  });

  it("rejects invalid model references", () => {
    expect(parseModelReference("invalid")).toBeNull();
  });
});
