#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$HOME/.config/containers/systemd" "$HOME/.config/systemd/user"
cp "$ROOT/ops/quadlet/uptime-kuma.container" "$HOME/.config/containers/systemd/"
cp "$ROOT/ops/monitoring/adhocint-monitoring."{service,timer} "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
if [[ -f "$ROOT/shared/monitoring/config.json" ]]; then
  systemctl --user enable --now adhocint-monitoring.timer
fi
# Kuma is started explicitly after its documented data migration, never upgraded
# automatically by this installer or an unrelated application deployment.
