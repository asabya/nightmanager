import { describe, expect, it } from "vitest";
import { classifyTaskShape, chooseDelegate } from "../../src/core/routing.js";

describe("routing", () => {
  it("classifies implementation tasks", () => {
    expect(classifyTaskShape("implement the retry logic in finder")).toBe("implementation");
  });

  it("classifies reasoning tasks", () => {
    expect(classifyTaskShape("debug why finder stops too early")).toBe("reasoning");
  });

  it("classifies search tasks", () => {
    expect(classifyTaskShape("find where oracle resolves its model")).toBe("search");
  });

  it("chooses the correct delegate", () => {
    expect(chooseDelegate("implementation")).toBe("worker");
    expect(chooseDelegate("reasoning")).toBe("oracle");
    expect(chooseDelegate("search")).toBe("finder");
  });
});
