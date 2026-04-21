import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("combined entrypoint", () => {
    it("registers finder and oracle tool modules", () => {
        const source = readFileSync("src/index.ts", "utf-8");
        expect(source).toContain("finderTool");
        expect(source).toContain("oracleTool");
    });
});
//# sourceMappingURL=entrypoint.test.js.map