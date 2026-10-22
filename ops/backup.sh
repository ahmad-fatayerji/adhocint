#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -z "${ENV_FILE:-}" ]]; then
  ENV_FILE="$ROOT_DIR/shared/.env.production"
  [[ -f "$ENV_FILE" ]] || ENV_FILE="$ROOT_DIR/.env.production"
fi
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
source "$ROOT_DIR/ops/storage-common.sh"
POSTGRES_USER="$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | tail -n1)"
POSTGRES_DB="$(sed -n 's/^POSTGRES_DB=//p' "$ENV_FILE" | tail -n1)"
MINIO_BUCKET="$(sed -n 's/^MINIO_BUCKET=//p' "$ENV_FILE" | tail -n1)"
: "${MINIO_BUCKET:?}"
OUT_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR/minio/$MINIO_BUCKET"
echo "Backing up to $OUT_DIR (pause writers for a consistent DB/object pair)"
podman exec "${POSTGRES_CONTAINER:-adhocint-db}" pg_dump -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" -Fc > "$OUT_DIR/db.dump"
STORAGE_CLIENT_MOUNTS=(-v "$OUT_DIR/minio:/backup")
storage_client copy --metadata --transfers 2 --checkers 2 "storage:${MINIO_BUCKET:?}" "/backup/$MINIO_BUCKET"
storage_client check --download --checkers 2 "storage:$MINIO_BUCKET" "/backup/$MINIO_BUCKET"
printf 'created_utc=%s\npostgres_db=%s\nminio_bucket=%s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "$POSTGRES_DB" "$MINIO_BUCKET" > "$OUT_DIR/manifest.txt"
echo "Backup verified. Retention is manual; migration backups must be kept at least 14 days."
