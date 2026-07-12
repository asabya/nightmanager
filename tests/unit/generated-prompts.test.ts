import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ROLES,
  parseCanonical,
  renderGeneratedTs,
  renderClaudeAgent,
  constName,
  check,
  type CheckPaths,
} from "../../scripts/generate-prompts.js";
import * as generated from "../../src/shared/generated-prompts.js";
import { LIBRARIAN_SYSTEM_PROMPT, MANAGER_SYSTEM_PROMPT, WORKER_SYSTEM_PROMPT } from "../../src/core/prompts.js";

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

describe("check (non-mutating drift gate)", () => {
  /** Copy the real canonical + generated outputs into a temp tree so tests can mutate them. */
  function withTempTree(fn: (paths: Required<CheckPaths>) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "nm-check-"));
    const paths = {
      agentsDir: join(dir, "prompts-agents"),
      generatedTsPath: join(dir, "generated-prompts.ts"),
      claudeAgentsDir: join(dir, "claude-agents"),
    };
    try {
      cpSync(agentsDir, paths.agentsDir, { recursive: true });
      cpSync(generatedTsPath, paths.generatedTsPath);
      cpSync(claudeAgentsDir, paths.claudeAgentsDir, { recursive: true });
      fn(paths);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("reports no drift on the committed tree", () => {
    expect(check()).toEqual([]);
  });

  it("does not modify the working tree", () => {
    const before = readFileSync(generatedTsPath, "utf-8");
    check();
    expect(readFileSync(generatedTsPath, "utf-8")).toBe(before);
  });

  it("reports a stale output after a canonical edit", () => {
    withTempTree((paths) => {
      const canonical = join(paths.agentsDir, "finder.md");
      writeFileSync(canonical, `${readFileSync(canonical, "utf-8")}\nEXTRA LINE\n`, "utf-8");
      const drift = check(paths);
      expect(drift.some((d) => d.includes("stale"))).toBe(true);
    });
  });

  it("reports a deleted agent file as missing", () => {
    withTempTree((paths) => {
      rmSync(join(paths.claudeAgentsDir, "oracle.md"));
      const drift = check(paths);
      expect(drift).toEqual([expect.stringContaining("oracle.md: missing")]);
    });
  });

  it("reports an agent file with no canonical role as orphaned", () => {
    withTempTree((paths) => {
      writeFileSync(join(paths.claudeAgentsDir, "sixth-role.md"), "---\nname: sixth-role\n---\n", "utf-8");
      const drift = check(paths);
      expect(drift).toEqual([expect.stringContaining("sixth-role.md: orphaned")]);
    });
  });
});
