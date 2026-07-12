import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ROLES,
  parseCanonical,
  renderGeneratedTs,
  renderClaudeAgent,
  constName,
} from "../../scripts/generate-prompts.js";
import * as generated from "../../src/shared/generated-prompts.js";
import { MANAGER_SYSTEM_PROMPT, WORKER_SYSTEM_PROMPT } from "../../src/core/prompts.js";
import { LIBRARIAN_SYSTEM_PROMPT } from "../../src/tools/librarian.js";

const repoRoot = process.cwd();
const agentsDir = join(repoRoot, "prompts", "agents");
const claudeAgentsDir = join(repoRoot, "integrations", "claude-code", "agents");
const generatedTsPath = join(repoRoot, "src", "shared", "generated-prompts.ts");
const generatedConsts = generated as unknown as Record<string, string>;

describe("canonical prompt generation", () => {
  it("has a canonical markdown file for each of the five roles", () => {
    for (const role of ROLES) {
      expect(existsSync(join(agentsDir, `${role}.md`)), `${role}.md exists`).toBe(true);
    }
  });

  it("generated Pi module exposes each canonical body verbatim", () => {
    for (const role of ROLES) {
      expect(generatedConsts[constName(role)]).toBe(parseCanonical(role).body);
    }
  });

  it("committed Pi module matches a fresh render (staleness gate)", () => {
    const onDisk = readFileSync(generatedTsPath, "utf-8");
    expect(onDisk).toBe(renderGeneratedTs(ROLES.map((role) => parseCanonical(role))));
  });

  it("committed Claude agent files match a fresh render (staleness gate)", () => {
    for (const role of ROLES) {
      const onDisk = readFileSync(join(claudeAgentsDir, `${role}.md`), "utf-8");
      expect(onDisk).toBe(renderClaudeAgent(parseCanonical(role)));
    }
  });

  it("generation is deterministic", () => {
    const first = renderGeneratedTs(ROLES.map((role) => parseCanonical(role)));
    const second = renderGeneratedTs(ROLES.map((role) => parseCanonical(role)));
    expect(first).toBe(second);
  });

  it("detects a stale canonical change", () => {
    const prompt = parseCanonical("finder");
    const mutated = renderClaudeAgent({ ...prompt, body: `${prompt.body}\nEXTRA LINE` });
    const onDisk = readFileSync(join(claudeAgentsDir, "finder.md"), "utf-8");
    expect(mutated).not.toBe(onDisk);
  });

  it("Pi composed prompts embed the canonical bodies", () => {
    expect(MANAGER_SYSTEM_PROMPT).toContain(generated.MANAGER_CANONICAL);
    expect(WORKER_SYSTEM_PROMPT).toContain(generated.WORKER_CANONICAL);
    expect(LIBRARIAN_SYSTEM_PROMPT).toContain(generated.LIBRARIAN_CANONICAL);
  });
});
