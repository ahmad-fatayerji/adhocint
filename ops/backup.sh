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

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

BACKUP_BASE_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TS="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT_DIR="$BACKUP_BASE_DIR/$TS"
mkdir -p "$OUT_DIR"

DOCKER_COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "==> Backing up Postgres to $OUT_DIR/db.dump"
"${DOCKER_COMPOSE[@]}" exec -T db pg_dump -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" -Fc > "$OUT_DIR/db.dump"

echo "==> Backing up MinIO bucket '$MINIO_BUCKET' to $OUT_DIR/minio/"
mkdir -p "$OUT_DIR/minio"

# Use mc in the compose network (no host port assumptions)
"${DOCKER_COMPOSE[@]}" run --rm -T \
  -v "$OUT_DIR/minio:/backup" \
  mc sh -lc '
    set -e
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
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
