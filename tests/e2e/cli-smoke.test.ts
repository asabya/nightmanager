import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

import extension from "../../src/index.js";

describe("cli smoke prerequisites", () => {
  it("has a source extension entrypoint", () => {
    expect(existsSync("src/index.ts")).toBe(true);
    expect(typeof extension).toBe("function");
  });
});
