#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adhocint}"
ENV_FILE="${ENV_FILE:-$APP_DIR/shared/.env.production}"
NETWORK_NAME="${PODMAN_NETWORK:-adhocint}"
SYSTEMD_SCOPE="${SYSTEMD_SCOPE:-auto}"

if [[ -e "$APP_DIR/shared/storage-migration.lock" ]]; then
  echo "Storage maintenance is in progress; refusing deployment." >&2
  exit 1
fi
if [[ "${ADHOCINT_DEPLOY_LOCK_HELD:-0}" != 1 ]]; then
  exec 9>"$APP_DIR/shared/deploy.lock"
  flock -n 9 || { echo "Another deployment is running." >&2; exit 1; }
  export ADHOCINT_DEPLOY_LOCK_HELD=1
fi

if [[ "$SYSTEMD_SCOPE" == "auto" ]]; then
  if [[ "$(id -u)" -eq 0 ]]; then
    SYSTEMD_SCOPE="system"
  else
    SYSTEMD_SCOPE="user"
  fi
fi

if [[ "$SYSTEMD_SCOPE" == "system" && "$(id -u)" -ne 0 ]]; then
  echo "ERROR: SYSTEMD_SCOPE=system requires root privileges." >&2
  exit 1
fi

if [[ "$SYSTEMD_SCOPE" == "user" ]]; then
  if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
    export XDG_RUNTIME_DIR="/run/user/$(id -u)"
  fi
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
    export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
  fi
  QUADLET_DIR="${QUADLET_DIR:-$HOME/.config/containers/systemd}"
  SYSTEMCTL=(systemctl --user)
  JOURNALCTL=(journalctl --user)
else
  QUADLET_DIR="${QUADLET_DIR:-/etc/containers/systemd}"
  SYSTEMCTL=(systemctl)
  JOURNALCTL=(journalctl)
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
  script_before="$(cksum "$0" | awk '{print $1}')"
  git fetch --all --prune
  git reset --hard "${GIT_REF:-origin/master}"
  script_after="$(cksum "$0" | awk '{print $1}')"
  if [[ "$script_before" != "$script_after" ]]; then
    echo "==> Re-executing updated deploy script"
    exec env GIT_PULL=0 "$0" "$@"
  fi
fi

mkdir -p "$QUADLET_DIR"
cp "$APP_DIR/ops/quadlet/"*.container "$QUADLET_DIR/"

if ! podman network exists "$NETWORK_NAME"; then
  podman network create "$NETWORK_NAME"
fi

echo "==> Building images"
podman build -t localhost/adhocint-web:latest .
podman build --target builder -t localhost/adhocint-migrate:latest .

echo "==> Reloading systemd ${SYSTEMD_SCOPE} units"
if ! "${SYSTEMCTL[@]}" daemon-reload; then
  if [[ "$SYSTEMD_SCOPE" == "user" ]]; then
    echo "ERROR: systemctl --user failed. Ensure the user manager is running and DBUS_SESSION_BUS_ADDRESS/XDG_RUNTIME_DIR are set." >&2
  fi
  exit 1
fi

# Wait for quadlet generator to create service units
sleep 2

# Verify units exist before enabling
echo "==> Available adhocint units:"
"${SYSTEMCTL[@]}" list-unit-files 'adhocint-*' || true

echo "==> Starting database and minio services"
start_unit() {
  unit="$1"
  echo "==> Starting $unit"
  if ! "${SYSTEMCTL[@]}" start "$unit"; then
    echo "ERROR: $unit failed to start" >&2
    echo "==> systemctl status $unit"
    "${SYSTEMCTL[@]}" status "$unit" --no-pager || true
    echo "==> journalctl -xeu $unit"
    "${JOURNALCTL[@]}" -xeu "$unit" --no-pager || true
    # Try to show podman logs for the container with the same base name
    cname="${unit%%.*}"
    echo "==> podman logs for container: $cname"
    podman logs --tail=200 "$cname" || true
    exit 1
  fi
}

start_unit adhocint-db.service
start_unit adhocint-minio.service

# Starting an already-active unit does not apply a changed image definition.
# Image upgrades require the documented backup/rehearsal/cutover procedure.
EXPECTED_STORAGE_IMAGE="$(sed -n 's/^Image=//p' "$APP_DIR/ops/quadlet/adhocint-minio.container")"
EXPECTED_STORAGE_ID="$(podman image inspect "$EXPECTED_STORAGE_IMAGE" --format '{{.Id}}')"
RUNNING_STORAGE_ID="$(podman inspect adhocint-minio --format '{{.Image}}')"
if [[ "$RUNNING_STORAGE_ID" != "$EXPECTED_STORAGE_ID" ]]; then
  echo "Storage image differs from the pinned image; perform a storage migration before deploying." >&2
  exit 1
fi

echo "==> Waiting for Postgres"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
for i in $(seq 1 60); do
  if podman exec adhocint-db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
podman exec adhocint-db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

echo "==> Waiting for authenticated S3 access and ensuring bucket"
source "$APP_DIR/ops/storage-common.sh"
storage_client ensure-bucket >/dev/null

echo "==> Running migrations"
podman run --rm --network "$NETWORK_NAME" --env-file "$ENV_FILE" \
  localhost/adhocint-migrate:latest npx prisma migrate deploy

echo "==> Starting web"
if "${SYSTEMCTL[@]}" is-active --quiet adhocint-web.service; then
  "${SYSTEMCTL[@]}" restart adhocint-web.service
else
  "${SYSTEMCTL[@]}" start adhocint-web.service
fi

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
