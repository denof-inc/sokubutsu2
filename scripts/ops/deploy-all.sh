#!/usr/bin/env bash
set -euo pipefail

# One-shot deployment helper: build, up, funnel, webhook, verify

echo "[deploy] Build (no-cache, pull)"
docker compose build --no-cache --pull

echo "[deploy] Up"
docker compose up -d

echo "[deploy] Funnel"
bash scripts/ops/ensure-funnel.sh

echo "[deploy] Webhook"
bash scripts/ops/ensure-webhook.sh

echo "[deploy] Verify"
bash scripts/ops/verify.sh

echo "[deploy] Completed"

