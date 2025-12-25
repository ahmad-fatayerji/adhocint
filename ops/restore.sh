#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ops/restore.sh <backup_dir>" >&2
  exit 1
fi

BACKUP_DIR_IN="$1"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE. Create it from .env.production.example" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

DB_DUMP="$BACKUP_DIR_IN/db.dump"
MINIO_DIR="$BACKUP_DIR_IN/minio/$MINIO_BUCKET"

if [[ ! -f "$DB_DUMP" ]]; then
  echo "❌ Missing db dump: $DB_DUMP" >&2
  exit 1
fi
if [[ ! -d "$MINIO_DIR" ]]; then
  echo "❌ Missing minio backup dir: $MINIO_DIR" >&2
  exit 1
fi

DOCKER_COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "==> Ensuring db + minio are up"
"${DOCKER_COMPOSE[@]}" up -d db minio

echo "==> Restoring Postgres from $DB_DUMP"
cat "$DB_DUMP" | "${DOCKER_COMPOSE[@]}" exec -T db pg_restore -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" --clean --if-exists

echo "==> Restoring MinIO bucket '$MINIO_BUCKET' from $MINIO_DIR"
"${DOCKER_COMPOSE[@]}" run --rm -T \
  -v "$BACKUP_DIR_IN/minio:/backup" \
  mc sh -lc '
    set -e
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
    mc mirror --overwrite "/backup/$MINIO_BUCKET" "local/$MINIO_BUCKET"
  '

echo "✅ Restore complete" 
