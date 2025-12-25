#!/usr/bin/env bash
set -euo pipefail

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

POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
MINIO_BUCKET="$(grep -E '^MINIO_BUCKET=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"

BACKUP_BASE_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TS="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT_DIR="$BACKUP_BASE_DIR/$TS"
mkdir -p "$OUT_DIR"

echo "==> Backing up Postgres to $OUT_DIR/db.dump"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
podman exec -T adhocint-db pg_dump -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" -Fc > "$OUT_DIR/db.dump"

echo "==> Backing up MinIO bucket '$MINIO_BUCKET' to $OUT_DIR/minio/"
mkdir -p "$OUT_DIR/minio"

# Use mc in the podman network (no host port assumptions)
podman run --rm -T --network adhocint --env-file "$ENV_FILE" \
  -v "$OUT_DIR/minio:/backup" \
  minio/mc:latest sh -lc '
    set -e
    mc alias set local http://adhocint-minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
    mc mirror --overwrite --remove "local/$MINIO_BUCKET" "/backup/$MINIO_BUCKET"
  '

echo "==> Writing manifest"
cat > "$OUT_DIR/manifest.txt" <<EOF
created_utc=$TS
postgres_db=$POSTGRES_DB
minio_bucket=$MINIO_BUCKET
EOF

# Optional rotation
KEEP="${BACKUP_KEEP:-10}"
if [[ "$KEEP" =~ ^[0-9]+$ ]] && (( KEEP > 0 )); then
  echo "==> Rotating backups (keeping last $KEEP)"
  ls -1dt "$BACKUP_BASE_DIR"/* 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -rf
fi

echo "✅ Backup complete: $OUT_DIR" 
