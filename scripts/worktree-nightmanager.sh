#!/usr/bin/env bash
set -euo pipefail

# Deprecated compatibility shim.
# Prefer scripts/nightmanager.sh.

NIGHTMANAGER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANONICAL="$NIGHTMANAGER_ROOT/scripts/nightmanager.sh"

if [[ ! -x "$CANONICAL" ]]; then
  echo "Missing canonical Nightmanager runner: $CANONICAL" >&2
  exit 1
fi

echo "scripts/worktree-nightmanager.sh is deprecated; forwarding to scripts/nightmanager.sh" >&2
exec "$CANONICAL" "$@"
