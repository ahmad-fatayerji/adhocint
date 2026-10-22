#!/usr/bin/env bash
set -euo pipefail
[[ $# -eq 1 ]] || { echo "Usage: ops/restore.sh <backup_dir>" >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -z "${ENV_FILE:-}" ]]; then
  ENV_FILE="$ROOT_DIR/shared/.env.production"
  [[ -f "$ENV_FILE" ]] || ENV_FILE="$ROOT_DIR/.env.production"
fi
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
BACKUP_DIR_IN="$(cd "$1" && pwd)"
source "$ROOT_DIR/ops/storage-common.sh"
POSTGRES_USER="$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | tail -n1)"
POSTGRES_DB="$(sed -n 's/^POSTGRES_DB=//p' "$ENV_FILE" | tail -n1)"
MINIO_BUCKET="$(sed -n 's/^MINIO_BUCKET=//p' "$ENV_FILE" | tail -n1)"
[[ -s "$BACKUP_DIR_IN/db.dump" && -d "$BACKUP_DIR_IN/minio/${MINIO_BUCKET:?}" ]] || {
  echo "Missing database dump or legacy minio/<bucket> object directory" >&2; exit 1;
}
if [[ "${SYSTEMD_SCOPE:-auto}" = system || ( "${SYSTEMD_SCOPE:-auto}" = auto && "$(id -u)" -eq 0 ) ]]; then SYSTEMCTL=(systemctl); else SYSTEMCTL=(systemctl --user); fi
echo "Stop writers before restoring a DB/object pair. Existing destination-only objects are retained."
if [[ "${SKIP_SERVICE_START:-0}" != 1 ]]; then
  "${SYSTEMCTL[@]}" start adhocint-db.service adhocint-minio.service
fi
storage_client ensure-bucket >/dev/null
STORAGE_CLIENT_MOUNTS=(-v "$BACKUP_DIR_IN/minio:/backup:ro")
storage_client copy --metadata --transfers 2 --checkers 2 "/backup/$MINIO_BUCKET" "storage:$MINIO_BUCKET"
storage_client check --download --one-way --checkers 2 "/backup/$MINIO_BUCKET" "storage:$MINIO_BUCKET"
podman exec -i "${POSTGRES_CONTAINER:-adhocint-db}" pg_restore -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" --clean --if-exists --exit-on-error < "$BACKUP_DIR_IN/db.dump"
echo "Restore complete"
