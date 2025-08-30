#!/usr/bin/env bash
set -euo pipefail

# Local/staging deployment helper for current branch

echo "==> Detecting branch"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SHA=$(git rev-parse --short HEAD)
echo "Branch: ${BRANCH} (${SHA})"

echo "==> Stopping existing containers"
docker compose down || true

echo "==> Building image (no cache, pull base)"
docker compose build --no-cache --pull

echo "==> Starting containers"
docker compose up -d

echo "==> Tailing recent logs (Ctrl-C to exit)"
docker compose logs -f --tail=50

