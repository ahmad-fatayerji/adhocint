#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE. Create it from .env.production.example" >&2
  exit 1
fi

DOCKER_COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

# Optional: update code if this repo is git-cloned on the VPS
if [[ "${GIT_PULL:-0}" == "1" ]]; then
  echo "==> Updating repo (git pull)"
  git fetch --all --prune
  git reset --hard "${GIT_REF:-origin/master}"
fi

echo "==> Backup before deploy"
"$ROOT_DIR/ops/backup.sh"

echo "==> Building web image"
"${DOCKER_COMPOSE[@]}" build web

echo "==> Running migrations"
"${DOCKER_COMPOSE[@]}" run --rm migrate

echo "==> Starting stack"
"${DOCKER_COMPOSE[@]}" up -d db minio minio-init web

echo "==> Health check"
PORT="${APP_PORT:-3001}"
for i in $(seq 1 60); do
  if curl -sfI "http://127.0.0.1:${PORT}" >/dev/null 2>&1; then
    echo "✅ App is responding on :$PORT"
    exit 0
  fi
  sleep 1
done

echo "❌ App did not become healthy on :$PORT" >&2
"${DOCKER_COMPOSE[@]}" logs --tail=200 web || true
exit 1
