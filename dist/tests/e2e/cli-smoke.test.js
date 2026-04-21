import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
describe("cli smoke prerequisites", () => {
    it("has a built extension entrypoint after build", () => {
        expect(existsSync("dist/index.js") || existsSync("dist/src/index.js")).toBe(true);
    });
});
//# sourceMappingURL=cli-smoke.test.js.map