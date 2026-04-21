import { describe, expect, it } from "vitest";
import { extractFinalText } from "../../src/core/result.js";
describe("result helpers", () => {
    it("extracts text blocks from assistant messages", () => {
        expect(extractFinalText([
            { role: "assistant", content: [{ type: "text", text: "hello" }] },
        ])).toBe("hello");
    });
});
//# sourceMappingURL=result.test.js.map