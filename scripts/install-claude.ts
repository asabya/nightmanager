/**
 * install-claude.ts
 *
 * Installs the native Claude Code integration (subagents + skills) from this
 * package into a `.claude` directory. Pure filesystem copy — no network, no SDK.
 *
 * Sources (all shipped in the npm package):
 *   integrations/claude-code/agents/*.md        -> <base>/agents/
 *   skills/<name>/                              -> <base>/skills/<name>/   (shared)
 *   integrations/claude-code/skills/<name>/     -> <base>/skills/<name>/   (Claude-only, e.g. nightmanager)
 *   integrations/claude-code/skills/<name>.addendum.md  appended to that skill's SKILL.md
 *   prompts/review-personas.md                  -> <base>/skills/code-review/review-personas.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export type InstallScope = "user" | "project";

export interface InstallOptions {
  scope?: InstallScope;
  force?: boolean;
  dryRun?: boolean;
  /** Base directory for `project` scope; defaults to process.cwd(). */
  cwd?: string;
  /** Home directory for `user` scope; defaults to os.homedir(). Overridable for tests. */
  home?: string;
  /** Package root override; auto-detected from this module's location otherwise. */
  packageRoot?: string;
}

export interface InstallResult {
  scope: InstallScope;
  targetBase: string;
  created: string[];
  /** Existing files identical to the packaged version (nothing to do). */
  skipped: string[];
  /** Existing files that differ from the packaged version; need --force to update. */
  stale: string[];
  updated: string[];
}

interface FileOp {
  dest: string;
  content: string;
}

const CLAUDE_SKILLS_REL = join("integrations", "claude-code", "skills");
const CLAUDE_AGENTS_REL = join("integrations", "claude-code", "agents");

// Extra package files shipped into a skill's directory, keyed by skill name.
// `src` is relative to the package root, `dest` to the installed skill dir.
const SKILL_EXTRA_ASSETS: Record<string, { src: string; dest: string }[]> = {
  // code-review ships the review rubric as a co-located asset (no prompts/ dir on Claude).
  "code-review": [{ src: join("prompts", "review-personas.md"), dest: "review-personas.md" }],
};

function readIfExists(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
}

/** Walk up from `startDir` until a directory holds the Claude integration agents. */
export function findPackageRoot(startDir: string): string {
  let dir = startDir;
  for (let depth = 0; depth < 12; depth++) {
    if (existsSync(join(dir, CLAUDE_AGENTS_REL))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate the nightmanager package root (no ${CLAUDE_AGENTS_REL} found above ${startDir}). ` +
      "Reinstall the package or pass packageRoot explicitly.",
  );
}

function collectAgentOps(packageRoot: string, agentsTarget: string): FileOp[] {
  const dir = join(packageRoot, CLAUDE_AGENTS_REL);
  if (!existsSync(dir)) throw new Error(`Missing agent definitions at ${dir}`);
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => ({
      dest: join(agentsTarget, entry.name),
      content: readFileSync(join(dir, entry.name), "utf-8"),
    }));
}

function collectSkillDirOps(srcDir: string, destDir: string, packageRoot: string, skillName: string): FileOp[] {
  const ops: FileOp[] = [];
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name);
    if (entry.isDirectory()) {
      ops.push(...collectSkillDirOps(src, join(destDir, entry.name), packageRoot, skillName));
      continue;
    }
    let content = readFileSync(src, "utf-8");
    if (entry.name === "SKILL.md") {
      const addendum = readIfExists(join(packageRoot, CLAUDE_SKILLS_REL, `${skillName}.addendum.md`));
      if (addendum) content = `${content.trimEnd()}\n\n${addendum.trimStart()}`;
    }
    ops.push({ dest: join(destDir, entry.name), content });
  }
  for (const asset of SKILL_EXTRA_ASSETS[skillName] ?? []) {
    const content = readIfExists(join(packageRoot, asset.src));
    if (content !== undefined) ops.push({ dest: join(destDir, asset.dest), content });
  }
  return ops;
}

function collectSkillOps(packageRoot: string, skillsTarget: string): FileOp[] {
  const ops: FileOp[] = [];
  const collectFrom = (root: string) => {
    if (!existsSync(root)) return;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = join(root, entry.name);
      if (!existsSync(join(src, "SKILL.md"))) continue;
      ops.push(...collectSkillDirOps(src, join(skillsTarget, entry.name), packageRoot, entry.name));
    }
  };
  collectFrom(join(packageRoot, "skills")); // shared skills
  collectFrom(join(packageRoot, CLAUDE_SKILLS_REL)); // Claude-only skills (e.g. nightmanager)
  return ops;
}

function atomicWrite(dest: string, content: string): void {
  const dir = dirname(dest);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${basename(dest)}.tmp-${process.pid}`);
  try {
    writeFileSync(tmp, content, "utf-8");
    renameSync(tmp, dest);
  } catch (error) {
    // Don't leave the temp file behind if the write or rename failed.
    try {
      unlinkSync(tmp);
    } catch {
      /* nothing to clean up */
    }
    throw error;
  }
}

export function installClaude(options: InstallOptions = {}): InstallResult {
  const scope: InstallScope = options.scope ?? "user";
  const force = options.force ?? false;
  const dryRun = options.dryRun ?? false;
  const home = options.home ?? homedir();
  const cwd = options.cwd ?? process.cwd();
  const packageRoot = options.packageRoot ?? findPackageRoot(dirname(fileURLToPath(import.meta.url)));

  const targetBase = scope === "project" ? join(cwd, ".claude") : join(home, ".claude");
  const ops = [
    ...collectAgentOps(packageRoot, join(targetBase, "agents")),
    ...collectSkillOps(packageRoot, join(targetBase, "skills")),
  ];

  const created: string[] = [];
  const skipped: string[] = [];
  const stale: string[] = [];
  const updated: string[] = [];
  for (const op of ops) {
    const existing = readIfExists(op.dest);
    if (existing !== undefined && !force) {
      (existing === op.content ? skipped : stale).push(op.dest);
      continue;
    }
    if (!dryRun) atomicWrite(op.dest, op.content);
    (existing !== undefined ? updated : created).push(op.dest);
  }

  return { scope, targetBase, created, skipped, stale, updated };
}
