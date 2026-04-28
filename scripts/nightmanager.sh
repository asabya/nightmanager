#!/usr/bin/env bash
set -euo pipefail

# Run one autonomous Nightmanager cycle for this repository.
# Intended for cron/launchd. Configure with env vars below.

ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PI_BIN="${PI_BIN:-pi}"
NIGHTSHIFT_THINKING="${NIGHTSHIFT_THINKING:-high}"
LOG_DIR="${NIGHTSHIFT_LOG_DIR:-$ROOT/.pi/nightmanager/logs}"
SESSION_DIR="${NIGHTSHIFT_SESSION_DIR:-$ROOT/.pi/nightmanager/sessions}"
LOCK_DIR="${NIGHTSHIFT_LOCK_DIR:-$ROOT/.pi/nightmanager/lock}"

cd "$ROOT"
mkdir -p "$LOG_DIR" "$SESSION_DIR" "$(dirname "$LOCK_DIR")"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Nightmanager is already running: $LOCK_DIR" >&2
  exit 0
fi
cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "Could not find pi binary: $PI_BIN" >&2
  echo "Set PI_BIN=/absolute/path/to/pi when running from cron/launchd." >&2
  exit 127
fi

SUBAGENTS_EXTENSION="${SUBAGENTS_EXTENSION:-}"
if [[ -z "$SUBAGENTS_EXTENSION" ]]; then
  if [[ -f "$ROOT/dist/index.js" ]]; then
    SUBAGENTS_EXTENSION="$ROOT/dist/index.js"
  else
    SUBAGENTS_EXTENSION="$ROOT/index.ts"
  fi
fi

if [[ ! -f "$SUBAGENTS_EXTENSION" ]]; then
  echo "The Nightmanager extension not found: $SUBAGENTS_EXTENSION" >&2
  echo "Run npm run build or set SUBAGENTS_EXTENSION=/path/to/nightmanager/dist/index.js" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
log_file="$LOG_DIR/nightmanager-$stamp.log"

pi_args=(
  --print
  --session-dir "$SESSION_DIR"
  --no-extensions
  --extension "$SUBAGENTS_EXTENSION"
  --thinking "$NIGHTSHIFT_THINKING"
  --tools read,bash,edit,write,manager
)

if [[ -n "${NIGHTSHIFT_MODEL:-}" ]]; then
  pi_args+=(--model "$NIGHTSHIFT_MODEL")
fi

if [[ -n "${NIGHTSHIFT_PROVIDER:-}" ]]; then
  pi_args+=(--provider "$NIGHTSHIFT_PROVIDER")
fi

context_args=()
add_context_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    context_args+=("@$path")
  fi
}

add_context_file "AGENTS.md"
add_context_file "AGENT_LOOP.md"
add_context_file "TODOs.md"
add_context_file "REVIEW_PERSONAS.md"
add_context_file "README.md"
add_context_file "docs/index.md"
add_context_file "package.json"

if [[ -d "$ROOT/specs" ]]; then
  while IFS= read -r -d '' spec_path; do
    spec_rel="${spec_path#"$ROOT"/}"
    spec_base="$(basename "$spec_rel")"
    if [[ "$spec_base" == draft-* ]]; then
      continue
    fi
    context_args+=("@$spec_rel")
  done < <(find "$ROOT/specs" -type f -name '*.md' -print0)
fi

add_context_file ".pi/prompts/nightmanager.md"

{
  echo "Nightmanager started at $stamp"
  echo "Root: $ROOT"
  echo "Extension: $SUBAGENTS_EXTENSION"
  echo "Session dir: $SESSION_DIR"
  echo "Context files: ${#context_args[@]}"
  echo

  "$PI_BIN" "${pi_args[@]}" \
    "${context_args[@]}" \
    "Run the Nightmanager prompt exactly as written. Use manager for implementation."

  echo
  echo "Nightmanager finished at $(date -u +%Y%m%dT%H%M%SZ)"
} 2>&1 | tee "$log_file"
