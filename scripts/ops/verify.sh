#!/usr/bin/env bash
set -euo pipefail

SERVICE=${SERVICE:-sokubutsu-mvp}

echo "[verify] Containers"
docker compose ps || true

echo "[verify] Health"
curl -I "${ADMIN_PUBLIC_URL%/}/health" || true

echo "[verify] WebhookInfo"
docker compose exec -T "$SERVICE" sh -lc '
  BASE="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}";
  curl -fsS "$BASE/getWebhookInfo" || true
'

echo
echo "[verify] Recent webhook request/response logs"
docker compose exec -T "$SERVICE" sh -lc 'tail -n 200 logs/* 2>/dev/null | grep -E "admin\.webhook\.(request|response)" || true'

