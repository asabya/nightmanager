import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installClaude, findPackageRoot } from "../../scripts/install-claude.js";
import { ROLES } from "../../scripts/generate-prompts.js";

const packageRoot = process.cwd();

function tempDir(prefix = "nm-install-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function withTempDir(fn: (dir: string) => void, prefix?: string): void {
  const dir = tempDir(prefix);
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("installClaude", () => {
  it("fresh project install writes every agent and skill", () => {
    withTempDir((dir) => {
      const result = installClaude({ scope: "project", cwd: dir, packageRoot });
      expect(result.created.length).toBeGreaterThanOrEqual(15);
      expect(result.skipped).toEqual([]);
      for (const role of ROLES) {
        expect(existsSync(join(dir, ".claude", "agents", `${role}.md`)), role).toBe(true);
      }
      expect(existsSync(join(dir, ".claude", "skills", "nightmanager", "SKILL.md"))).toBe(true);
      expect(existsSync(join(dir, ".claude", "skills", "code-review", "review-personas.md"))).toBe(true);
    });
  });

  it("does not overwrite an existing file without --force", () => {
    withTempDir((dir) => {
      const dest = join(dir, ".claude", "agents", "finder.md");
      mkdirSync(join(dir, ".claude", "agents"), { recursive: true });
      writeFileSync(dest, "USER CONTENT", "utf-8");
      const result = installClaude({ scope: "project", cwd: dir, packageRoot });
      expect(result.skipped).toContain(dest);
      expect(readFileSync(dest, "utf-8")).toBe("USER CONTENT");
    });
  });

  it("--force overwrites existing files", () => {
    withTempDir((dir) => {
      const dest = join(dir, ".claude", "agents", "finder.md");
      mkdirSync(join(dir, ".claude", "agents"), { recursive: true });
      writeFileSync(dest, "USER CONTENT", "utf-8");
      const result = installClaude({ scope: "project", cwd: dir, force: true, packageRoot });
      expect(result.updated).toContain(dest);
      expect(readFileSync(dest, "utf-8")).not.toBe("USER CONTENT");
    });
  });

  it("--dry-run writes nothing", () => {
    withTempDir((dir) => {
      const result = installClaude({ scope: "project", cwd: dir, dryRun: true, packageRoot });
      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(join(dir, ".claude"))).toBe(false);
    });
  });

  it("creates missing target directories", () => {
    withTempDir((base) => {
      const dir = join(base, "nested", "deeper");
      installClaude({ scope: "project", cwd: dir, packageRoot });
      expect(existsSync(join(dir, ".claude", "agents", "manager.md"))).toBe(true);
    });
  });

  it("handles target paths containing spaces", () => {
    withTempDir((dir) => {
      const result = installClaude({ scope: "project", cwd: dir, packageRoot });
      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(join(dir, ".claude", "agents", "worker.md"))).toBe(true);
    }, "nm install with spaces ");
  });

  it("repeated install is idempotent", () => {
    withTempDir((dir) => {
      installClaude({ scope: "project", cwd: dir, packageRoot });
      const result = installClaude({ scope: "project", cwd: dir, packageRoot });
      expect(result.created).toEqual([]);
      expect(result.updated).toEqual([]);
      expect(result.skipped.length).toBeGreaterThanOrEqual(15);
    });
  });

  it("user scope installs under the provided home directory", () => {
    withTempDir((home) => {
      const result = installClaude({ scope: "user", home, packageRoot });
      expect(result.targetBase).toBe(join(home, ".claude"));
      expect(existsSync(join(home, ".claude", "agents", "finder.md"))).toBe(true);
    });
  });

  it("reports a clear error when the package root has no agent definitions", () => {
    withTempDir((dir) => {
      expect(() => installClaude({ scope: "project", cwd: dir, packageRoot: dir })).toThrow(
        /agent definitions|package root/i,
      );
    });
  });

  it("findPackageRoot throws with guidance when the root is not found", () => {
    expect(() => findPackageRoot(tmpdir())).toThrow(/package root/i);
  });
});
