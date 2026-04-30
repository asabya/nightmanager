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
  SUBAGENTS_EXTENSION="$ROOT/src/index.ts"
fi

if [[ ! -f "$SUBAGENTS_EXTENSION" ]]; then
  echo "The Nightmanager extension not found: $SUBAGENTS_EXTENSION" >&2
  echo "Set SUBAGENTS_EXTENSION=/path/to/nightmanager/src/index.ts" >&2
  exit 1
fi

slugify_branch_part() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

branch_ref_exists() {
  local branch="$1"
  git show-ref --verify --quiet "refs/heads/$branch" \
    || git show-ref --verify --quiet "refs/remotes/origin/$branch"
}

free_branch_name() {
  local slug="$1"
  if [[ -z "$slug" ]]; then
    echo "Nightmanager could not derive a non-empty branch slug" >&2
    return 1
  fi

  local candidate="$slug"
  local suffix=2
  while branch_ref_exists "$candidate"; do
    candidate="$slug-$suffix"
    suffix=$((suffix + 1))
  done

  printf '%s\n' "$candidate"
}

select_active_batch() {
  local todo_file="${1:-TODOs.md}"
  local wanted_status="$2"
  local line status title spec current_status current_title current_spec

  current_status=""
  current_title=""
  current_spec=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^-[[:space:]]\[([^]]+)\][[:space:]](.+)$ ]]; then
      if [[ -n "$current_status" ]]; then
        if [[ "$current_status" == "$wanted_status" ]]; then
          if [[ ( "$current_status" == "bug" && ( -z "$current_spec" || "$(basename "$current_spec")" != draft-* ) ) || ( "$current_status" == "ready" && -n "$current_spec" && "$(basename "$current_spec")" != draft-* ) ]]; then
            NIGHTMANAGER_TODO_STATUS="$current_status"
            NIGHTMANAGER_TODO_TITLE="$current_title"
            NIGHTMANAGER_ACTIVE_SPEC="$current_spec"
            return 0
          fi
        fi
      fi
      current_status="${BASH_REMATCH[1]}"
      current_title="${BASH_REMATCH[2]}"
      current_spec=""
    elif [[ "$line" =~ ^[[:space:]]+-[[:space:]]Spec:[[:space:]]\`([^\`]+)\` ]]; then
      current_spec="${BASH_REMATCH[1]}"
    fi
  done < "$todo_file"

  if [[ -n "$current_status" && "$current_status" == "$wanted_status" ]]; then
    if [[ ( "$current_status" == "bug" && ( -z "$current_spec" || "$(basename "$current_spec")" != draft-* ) ) || ( "$current_status" == "ready" && -n "$current_spec" && "$(basename "$current_spec")" != draft-* ) ]]; then
      NIGHTMANAGER_TODO_STATUS="$current_status"
      NIGHTMANAGER_TODO_TITLE="$current_title"
      NIGHTMANAGER_ACTIVE_SPEC="$current_spec"
      return 0
    fi
  fi

  return 1
}

select_nightmanager_batch() {
  NIGHTMANAGER_TODO_STATUS=""
  NIGHTMANAGER_TODO_TITLE=""
  NIGHTMANAGER_ACTIVE_SPEC=""

  if ! select_active_batch "TODOs.md" "bug"; then
    select_active_batch "TODOs.md" "ready" || return 1
  fi

  if [[ -n "$NIGHTMANAGER_ACTIVE_SPEC" ]]; then
    NIGHTMANAGER_BATCH_KEY="$NIGHTMANAGER_ACTIVE_SPEC"
    NIGHTMANAGER_BRANCH_SLUG="$(slugify_branch_part "$(basename "$NIGHTMANAGER_ACTIVE_SPEC" .md)")"
  else
    NIGHTMANAGER_BATCH_KEY="bug-only:$NIGHTMANAGER_TODO_TITLE"
    NIGHTMANAGER_BRANCH_SLUG="$(slugify_branch_part "$NIGHTMANAGER_TODO_TITLE")"
  fi

  if [[ -z "$NIGHTMANAGER_BRANCH_SLUG" ]]; then
    echo "Nightmanager could not derive a non-empty branch slug for: $NIGHTMANAGER_TODO_TITLE" >&2
    return 2
  fi

  NIGHTMANAGER_BRANCH="$(free_branch_name "$NIGHTMANAGER_BRANCH_SLUG")"
}

if select_nightmanager_batch; then
  :
else
  select_status=$?
  if [[ "$select_status" -eq 1 ]]; then
    echo "No eligible Nightmanager TODO found in TODOs.md" >&2
    exit 0
  fi
  exit "$select_status"
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

add_context_file "prompts/agents.md"
add_context_file "prompts/agent-loop.md"
add_context_file "TODOs.md"
add_context_file "prompts/review-personas.md"
add_context_file "README.md"
add_context_file "package.json"

if [[ -n "$NIGHTMANAGER_ACTIVE_SPEC" ]]; then
  if [[ ! -f "$NIGHTMANAGER_ACTIVE_SPEC" ]]; then
    echo "Active Nightmanager spec not found: $NIGHTMANAGER_ACTIVE_SPEC" >&2
    exit 1
  fi
  context_args+=("@$NIGHTMANAGER_ACTIVE_SPEC")
else
  add_context_file "specs/TEMPLATE.md"
fi

add_context_file "prompts/nightmanager.md"

{
  echo "Nightmanager started at $stamp"
  echo "Root: $ROOT"
  echo "Extension: $SUBAGENTS_EXTENSION"
  echo "Session dir: $SESSION_DIR"
  echo "Selected TODO: [$NIGHTMANAGER_TODO_STATUS] $NIGHTMANAGER_TODO_TITLE"
  echo "Active batch key: $NIGHTMANAGER_BATCH_KEY"
  echo "Selected branch: $NIGHTMANAGER_BRANCH"
  echo "Context files: ${#context_args[@]}"
  echo

  "$PI_BIN" "${pi_args[@]}" \
    "${context_args[@]}" \
    "Run the Nightmanager prompt exactly as written. Use manager for implementation. Selected TODO: [$NIGHTMANAGER_TODO_STATUS] $NIGHTMANAGER_TODO_TITLE. Active batch key: $NIGHTMANAGER_BATCH_KEY. Selected branch name: $NIGHTMANAGER_BRANCH. Use this selected branch name instead of deriving a different one."

  echo
  echo "Nightmanager finished at $(date -u +%Y%m%dT%H%M%SZ)"
} 2>&1 | tee "$log_file"
