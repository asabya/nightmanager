#!/usr/bin/env node
import { installClaude, type InstallResult, type InstallScope } from "../scripts/install-claude.js";
import { isMainModule } from "../src/shared/is-main-module.js";

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
  report("Skipped (identical)", result.skipped);
  report("Out of date (pass --force to update)", result.stale);
  if (!dryRun && result.created.length === 0 && result.updated.length === 0) {
    const hint = result.stale.length > 0 ? " Pass --force to update the out-of-date files." : "";
    console.log(`\nNothing written — all files already present.${hint}`);
  }
}

const KNOWN_FLAGS = new Set(["--user", "--project", "--force", "--dry-run", "--help"]);

export function run(argv: string[]): number {
  const args = argv.slice(2);
  if (args.includes("-h") || args.includes("--help") || args.length === 0) {
    console.log(USAGE);
    return args.length === 0 ? 1 : 0;
  }

  const positionals = args.filter((arg) => !arg.startsWith("--"));
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const fail = (message: string): number => {
    console.error(`nightmanager: ${message}\n`);
    console.error(USAGE);
    return 1;
  };

  for (const flag of flags) {
    if (!KNOWN_FLAGS.has(flag)) return fail(`unknown flag "${flag}"`);
  }

  const [command, target, ...extra] = positionals;
  if (command === "install" && target === "claude") {
    if (extra.length > 0) return fail(`unexpected argument "${extra.join(" ")}"`);
    if (flags.has("--user") && flags.has("--project")) return fail("--user and --project are mutually exclusive");
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

  return fail(`unknown command "${positionals.join(" ")}"`);
}

if (isMainModule(import.meta.url)) process.exit(run(process.argv));
