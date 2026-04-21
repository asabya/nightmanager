import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("package scaffold", () => {
  it("creates the package entry files", () => {
    expect(existsSync(resolve(process.cwd(), "package.json"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "vitest.config.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "index.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/index.ts"))).toBe(true);
  });
});
