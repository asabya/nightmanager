import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("manager tool", () => {
  it("is registered by the combined entrypoint", () => {
    const source = readFileSync("src/index.ts", "utf-8");
    expect(source).toContain("managerTool");
  });
});
