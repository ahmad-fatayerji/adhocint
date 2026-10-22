#!/bin/sh
set -eu

export RCLONE_CONFIG_STORAGE_TYPE=s3
export RCLONE_CONFIG_STORAGE_PROVIDER=Minio
export RCLONE_CONFIG_STORAGE_ENDPOINT="${MINIO_ENDPOINT:?}"
export RCLONE_CONFIG_STORAGE_ACCESS_KEY_ID="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:?}}"
export RCLONE_CONFIG_STORAGE_SECRET_ACCESS_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:?}}"
export RCLONE_CONFIG_STORAGE_REGION=us-east-1
export RCLONE_CONFIG_STORAGE_FORCE_PATH_STYLE=true

if [ "${1:-}" = ensure-bucket ]; then
    # Authenticate before attempting creation; never suppress bucket errors.
    attempt=0
    until rclone --config /dev/null lsd storage: >/dev/null; do
        attempt=$((attempt + 1))
        [ "$attempt" -lt 60 ] || exit 1
        sleep 1
    done
    rclone --config /dev/null mkdir "storage:${MINIO_BUCKET:?}"
    exec rclone --config /dev/null lsf "storage:$MINIO_BUCKET" --max-depth 1
fi

exec rclone --config /dev/null "$@"
