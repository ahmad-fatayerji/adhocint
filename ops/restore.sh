#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ops/restore.sh <backup_dir>" >&2
  exit 1
fi

BACKUP_DIR_IN="$1"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
fi

ENV_FILE="${ENV_FILE:-.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE. Create it from .env.production.example" >&2
  exit 1
fi

POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
MINIO_BUCKET="$(grep -E '^MINIO_BUCKET=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"

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

echo "==> Ensuring db + minio are up"
systemctl --user enable --now adhocint-db.service adhocint-minio.service

echo "==> Restoring Postgres from $DB_DUMP"
cat "$DB_DUMP" | podman exec -T adhocint-db pg_restore -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" --clean --if-exists

echo "==> Restoring MinIO bucket '$MINIO_BUCKET' from $MINIO_DIR"
podman run --rm -T --network adhocint --env-file "$ENV_FILE" \
  -v "$BACKUP_DIR_IN/minio:/backup" \
  docker.io/minio/mc:latest sh -lc '
    set -e
    mc alias set local http://adhocint-minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
    mc mirror --overwrite "/backup/$MINIO_BUCKET" "local/$MINIO_BUCKET"
  '

echo "✅ Restore complete" 
