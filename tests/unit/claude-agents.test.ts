import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const AGENTS_DIR = join(process.cwd(), "integrations", "claude-code", "agents");
const ROLES = ["finder", "oracle", "librarian", "worker", "manager"] as const;

function parseFrontmatter(md: string): { frontmatter: Record<string, string>; body: string } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("missing frontmatter");
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { frontmatter, body: match[2] };
}

function loadAgent(role: string): { frontmatter: Record<string, string>; body: string } {
  return parseFrontmatter(readFileSync(join(AGENTS_DIR, `${role}.md`), "utf-8"));
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
