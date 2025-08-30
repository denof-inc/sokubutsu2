#!/usr/bin/env bash
set -euo pipefail

# Ensure Tailscale Funnel exposes admin port (3002) on HTTPS and print the URL

PORT=${ADMIN_PORT:-3002}

echo "[funnel] Ensuring Tailscale Funnel on :${PORT}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "[funnel] tailscale CLI not found. Please install and login once: https://tailscale.com/download" >&2
  exit 1
fi

# Make sure tailscaled is up and device is logged in (idempotent)
if ! tailscale status >/dev/null 2>&1; then
  echo "[funnel] Tailscale is not logged in. Run: sudo tailscale up" >&2
  exit 1
fi

# Enable HTTPS serve and Funnel for admin port (idempotent)
set +e
tailscale serve --https=443 http://localhost:${PORT} >/dev/null 2>&1
tailscale funnel 443 on >/dev/null 2>&1
tailscale funnel --bg ${PORT} >/dev/null 2>&1
set -e

# Extract public URL from status
PUB_URL=$(tailscale funnel status 2>/dev/null | awk '/https:\/\//{print $1; exit}')
if [[ -z "${PUB_URL}" ]]; then
  echo "[funnel] Failed to detect Funnel URL" >&2
  exit 2
fi

echo "[funnel] Public URL: ${PUB_URL}"

# Optionally sync ADMIN_PUBLIC_URL in local env files if present
for f in .env .env.production; do
  if [[ -f "$f" ]]; then
    if grep -q '^ADMIN_PUBLIC_URL=' "$f"; then
      sed -i.bak "s#^ADMIN_PUBLIC_URL=.*#ADMIN_PUBLIC_URL=${PUB_URL}#" "$f"
    else
      echo "ADMIN_PUBLIC_URL=${PUB_URL}" >> "$f"
    fi
    echo "[funnel] Updated ${f}: ADMIN_PUBLIC_URL=${PUB_URL}"
  fi
done

echo "[funnel] Done"

