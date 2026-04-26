import { describe, expect, it } from "vitest";
import { formatWorkerTask } from "../../src/core/handoff.js";

describe("handoff", () => {
  it("returns the plain task when no handoff context is provided", () => {
    expect(formatWorkerTask({ task: "Fix the failing test" })).toBe("Fix the failing test");
  });

  it("formats structured worker handoff context", () => {
    const task = formatWorkerTask({
      task: "Fix expired token handling",
      handoff: {
        objective: "Return TOKEN_EXPIRED for expired tokens.",
        findings: ["Finder found token handling in src/auth/middleware.ts."],
        targetFiles: ["src/auth/middleware.ts"],
        relatedFiles: ["tests/auth/middleware.test.ts"],
        decisions: ["Oracle recommends preserving ExpiredTokenError."],
        constraints: ["Smallest viable change."],
        risks: ["Do not alter malformed token behavior."],
        verification: {
          suggestedCommands: ["npm test -- tests/auth/middleware.test.ts"],
          rationale: "Narrowest existing auth middleware test.",
        },
        evidence: [
          {
            source: "finder",
            file: "src/auth/middleware.ts",
            line: 42,
            note: "Token errors are mapped here.",
          },
        ],
      },
    });

    expect(task).toContain("Handoff context:");
    expect(task).toContain("Target files:");
    expect(task).toContain("src/auth/middleware.ts");
    expect(task).toContain("Oracle recommends preserving ExpiredTokenError.");
    expect(task).toContain("npm test -- tests/auth/middleware.test.ts");
    expect(task).toContain("Do not repeat broad discovery already covered by finder/oracle");
  });
});
