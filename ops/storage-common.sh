#!/usr/bin/env bash
# Source from the deployment, backup and restore scripts.
STORAGE_OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STORAGE_CLIENT_IMAGE=docker.io/rclone/rclone@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5

storage_client() {
  podman run --rm --user 0 --network "${PODMAN_NETWORK:-adhocint}" \
    --env-file "$ENV_FILE" \
    -v "$STORAGE_OPS_DIR/storage-client-entrypoint.sh:/ops/storage-client-entrypoint.sh:ro" \
    "${STORAGE_CLIENT_MOUNTS[@]}" \
    --entrypoint /bin/sh "$STORAGE_CLIENT_IMAGE" /ops/storage-client-entrypoint.sh "$@"
}

STORAGE_CLIENT_MOUNTS=()
