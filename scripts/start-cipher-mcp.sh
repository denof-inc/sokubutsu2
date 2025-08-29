#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root from this script's location and switch there
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Minimal startup log (file only; no stdout)
mkdir -p "$REPO_ROOT/logs" || true
START_LOG="$REPO_ROOT/logs/cipher-mcp-start.log"
{
  printf '\n[%s] Starting cipher MCP\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  echo "PWD=$PWD"
  echo "HOME=$HOME"
  [ -f "$HOME/.env.cipher" ] && echo "~/.env.cipher exists" || echo "~/.env.cipher missing"
  [ -f ./.env ] && echo "./.env exists" || echo "./.env missing"
} >>"$START_LOG" 2>/dev/null || true

# Helper to load KEY=VALUE lines from a file without executing it
load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  while IFS= read -r line; do
    # Skip comments and empty lines
    case "$line" in
      ''|\#*) continue ;;
    esac
    # Normalize: strip leading 'export', trim spaces
    tmp=$(printf '%s' "$line" | sed -E 's/^[[:space:]]*export[[:space:]]+//; s/^[[:space:]]*//; s/[[:space:]]*$//')
    # Accept KEY=VAL or KEY: VAL
    if printf '%s' "$tmp" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*[:=]'; then
      key=$(printf '%s' "$tmp" | sed -E 's/^([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*[:=].*$/\1/')
      val=$(printf '%s' "$tmp" | sed -E 's/^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*(.*)$/\1/')
      # Trim surrounding single/double quotes
      case "$val" in
        \"*\") val="${val#\"}"; val="${val%\"}" ;;
        "'*'") val="${val#\'}"; val="${val%\'}" ;;
      esac
      export "$key=$val"
    fi
  done < "$file"
}

# Load from user-global then project-local env files
load_env_file "$HOME/.env.cipher"
load_env_file ./.env

# Fallback: if OPENAI_API_KEY still not set, try sourcing ~/.env.cipher
if [ -z "${OPENAI_API_KEY:-}" ] && [ -f "$HOME/.env.cipher" ]; then
  {
    echo "Fallback: sourcing ~/.env.cipher"
  } >>"$START_LOG" 2>/dev/null || true
  set +u +e
  set -a
  # shellcheck disable=SC1090
  . "$HOME/.env.cipher" 2>>"$START_LOG" || true
  set +a
  set -e -u
fi

# Ensure workspace-local paths and sensible defaults
export CIPHER_DB="${CIPHER_DB:-$PWD/data/cipher-sessions.db}"
export CIPHER_WORKSPACE="${CIPHER_WORKSPACE:-$PWD/.cipher}"

# Prefer local embedder to avoid hard dependency on external APIs unless overridden
export CIPHER_EMBEDDER="${CIPHER_EMBEDDER:-local}"

# Record whether the API key is visible to the process (no values logged)
{
  if [ -n "${OPENAI_API_KEY:-}" ]; then echo "OPENAI_API_KEY detected"; else echo "OPENAI_API_KEY not set"; fi
} >>"$START_LOG" 2>/dev/null || true

exec "$REPO_ROOT/node_modules/.bin/cipher" --mode mcp
