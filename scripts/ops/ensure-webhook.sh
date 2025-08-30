#!/usr/bin/env bash
set -euo pipefail

SERVICE=${SERVICE:-sokubutsu-mvp}

if [[ -z "${ADMIN_PUBLIC_URL:-}" ]]; then
  if [[ -f .env.production ]]; then export $(grep -E '^(ADMIN_PUBLIC_URL|TELEGRAM_BOT_TOKEN)=' .env.production | xargs); fi
  if [[ -f .env ]]; then export $(grep -E '^(ADMIN_PUBLIC_URL|TELEGRAM_BOT_TOKEN)=' .env | xargs); fi
fi

if [[ -z "${ADMIN_PUBLIC_URL:-}" ]]; then echo "[webhook] ADMIN_PUBLIC_URL not set" >&2; exit 1; fi

EXP_URL="${ADMIN_PUBLIC_URL%/}/telegram/webhook"
echo "[webhook] Ensure ${EXP_URL}"

docker compose exec -T "${SERVICE}" sh -lc '
  set -e
  EXP="'"${EXP_URL}"'";
  BASE="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}";
  curl -fsS -X POST -d "url=$EXP&drop_pending_updates=true" "$BASE/setWebhook" >/dev/null
  curl -fsS "$BASE/getWebhookInfo"
'

echo
echo "[webhook] Done"

