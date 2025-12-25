#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adhocint}"
ENV_FILE="${ENV_FILE:-$APP_DIR/shared/.env.production}"
QUADLET_DIR="${QUADLET_DIR:-$HOME/.config/containers/systemd}"
NETWORK_NAME="${PODMAN_NETWORK:-adhocint}"

if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# Double-check env file before starting services
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Env file missing before service start: $ENV_FILE" >&2
  exit 2
fi

cd "$APP_DIR"

# Optional: update code if this repo is git-cloned on the VPS
if [[ "${GIT_PULL:-0}" == "1" ]]; then
  echo "==> Updating repo (git pull)"
  git fetch --all --prune
  git reset --hard "${GIT_REF:-origin/master}"
fi

mkdir -p "$QUADLET_DIR"
cp "$APP_DIR/ops/quadlet/"*.container "$QUADLET_DIR/"

if ! podman network exists "$NETWORK_NAME"; then
  podman network create "$NETWORK_NAME"
fi

echo "==> Building images"
podman build -t localhost/adhocint-web:latest .
podman build --target builder -t localhost/adhocint-migrate:latest .

echo "==> Reloading systemd user units"
systemctl --user daemon-reload

# Wait for quadlet generator to create service units
sleep 2

# Verify units exist before enabling
echo "==> Available adhocint units:"
systemctl --user list-unit-files 'adhocint-*' || true

echo "==> Starting database and minio services"
start_unit() {
  unit="$1"
  echo "==> Starting $unit"
  if ! systemctl --user start "$unit"; then
    echo "ERROR: $unit failed to start" >&2
    echo "==> systemctl --user status $unit"
    systemctl --user status "$unit" --no-pager || true
    echo "==> journalctl --user -xeu $unit"
    journalctl --user -xeu "$unit" --no-pager || true
    # Try to show podman logs for the container with the same base name
    cname="${unit%%.*}"
    echo "==> podman logs for container: $cname"
    podman logs --tail=200 "$cname" || true
    exit 1
  fi
}

start_unit adhocint-db.service
start_unit adhocint-minio.service

echo "==> Waiting for Postgres"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
for i in $(seq 1 60); do
  if podman exec adhocint-db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Running migrations"
podman run --rm --network "$NETWORK_NAME" --env-file "$ENV_FILE" \
  localhost/adhocint-migrate:latest npx prisma migrate deploy

echo "==> Ensuring MinIO bucket"
podman run --rm --network "$NETWORK_NAME" --env-file "$ENV_FILE" \
  docker.io/minio/mc:latest sh -lc '
    set -e
    mc alias set local http://adhocint-minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
    mc mb -p "local/$MINIO_BUCKET" || true
  '

echo "==> Starting web"
systemctl --user start adhocint-web.service

echo "==> Health check"
APP_PORT="$(grep -E '^APP_PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
APP_PORT="${APP_PORT:-3001}"
for i in $(seq 1 60); do
  if curl -sfI "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
    echo "App is responding on :$APP_PORT"
    exit 0
  fi
  sleep 1
done

echo "App did not become healthy on :$APP_PORT" >&2
podman logs --tail=200 adhocint-web || true
exit 1
