#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { installClaude, type InstallResult, type InstallScope } from "../scripts/install-claude.js";

const USAGE = `nightmanager — Nightmanager CLI

Usage:
  npx nightmanager install claude [--user | --project] [--force] [--dry-run]

Commands:
  install claude    Install the native Claude Code integration (agents + skills).

Options:
  --user       Install to ~/.claude/ (default; available in every project).
  --project    Install to ./.claude/ in the current repository.
  --force      Overwrite files that already exist (default: skip them).
  --dry-run    Print what would change without writing anything.
  -h, --help   Show this help.
`;

function printResult(result: InstallResult, dryRun: boolean): void {
  const verb = dryRun ? "Would install" : "Installed";
  console.log(`${verb} Nightmanager for Claude Code (${result.scope}) into ${result.targetBase}`);
  const report = (label: string, files: string[]) => {
    if (files.length === 0) return;
    console.log(`\n${label} (${files.length}):`);
    for (const file of files) console.log(`  ${file}`);
  };
  report(dryRun ? "Create" : "Created", result.created);
  report(dryRun ? "Overwrite" : "Updated", result.updated);
  report("Skipped (already present; pass --force to overwrite)", result.skipped);
  if (!dryRun && result.created.length === 0 && result.updated.length === 0) {
    console.log("\nNothing to do — all files already present. Pass --force to overwrite.");
  }
}

export function run(argv: string[]): number {
  const args = argv.slice(2);
  if (args.includes("-h") || args.includes("--help") || args.length === 0) {
    console.log(USAGE);
    return args.length === 0 ? 1 : 0;
  }

  const [command, target] = args;
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));

  if (command === "install" && target === "claude") {
    const scope: InstallScope = flags.has("--project") ? "project" : "user";
    const dryRun = flags.has("--dry-run");
    try {
      const result = installClaude({ scope, force: flags.has("--force"), dryRun });
      printResult(result, dryRun);
      return 0;
    } catch (error) {
      console.error(`nightmanager: ${(error as Error).message}`);
      return 1;
    }
  }

  console.error(`nightmanager: unknown command "${args.join(" ")}"\n`);
  console.error(USAGE);
  return 1;
}

function isMainModule(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return realpathSync(arg) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) process.exit(run(process.argv));
