import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * True when the module identified by `importMetaUrl` is the process entrypoint
 * (invoked directly, e.g. `node dist/bin/nightmanager.js` or `tsx script.ts`),
 * rather than imported by another module. Pass `import.meta.url` from the caller —
 * reading it here would resolve to this helper, not the caller.
 */
export function isMainModule(importMetaUrl: string): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return realpathSync(arg) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
