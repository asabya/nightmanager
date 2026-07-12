import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROLES, parseFrontmatter, type Frontmatter } from "../../scripts/generate-prompts.js";

const AGENTS_DIR = join(process.cwd(), "integrations", "claude-code", "agents");

function loadAgent(role: string): Frontmatter {
  return parseFrontmatter(readFileSync(join(AGENTS_DIR, `${role}.md`), "utf-8"), `${role}.md`);
}

function toolList(frontmatter: Record<string, string>): string[] {
  return (frontmatter.tools ?? "")
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean);
}

describe("claude agent definitions", () => {
  it("each agent declares a matching name, a description, and a model", () => {
    for (const role of ROLES) {
      const { frontmatter } = loadAgent(role);
      expect(frontmatter.name).toBe(role);
      expect((frontmatter.description ?? "").length).toBeGreaterThan(0);
      expect((frontmatter.model ?? "").length).toBeGreaterThan(0);
    }
  });

  it("read-only roles have no edit or write tools", () => {
    for (const role of ["finder", "oracle", "librarian"]) {
      const tools = toolList(loadAgent(role).frontmatter);
      expect(tools, `${role} tools`).not.toContain("Edit");
      expect(tools, `${role} tools`).not.toContain("Write");
    }
  });

  it("worker has implementation tools", () => {
    const tools = toolList(loadAgent("worker").frontmatter);
    expect(tools).toEqual(expect.arrayContaining(["Read", "Edit", "Write", "Bash"]));
  });

  it("worker instructs rejecting an insufficient handoff", () => {
    const { body } = loadAgent("worker");
    expect(body).toContain("structured handoff");
    expect(body.toLowerCase()).toContain("missing");
  });

  it("manager can delegate via Agent but cannot edit or write", () => {
    const tools = toolList(loadAgent("manager").frontmatter);
    expect(tools).toContain("Agent");
    expect(tools).not.toContain("Edit");
    expect(tools).not.toContain("Write");
  });

  it("librarian has external research tools", () => {
    const tools = toolList(loadAgent("librarian").frontmatter);
    expect(tools).toEqual(expect.arrayContaining(["WebFetch", "WebSearch"]));
  });
});
