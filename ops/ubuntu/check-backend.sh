#!/usr/bin/env bash
# Quick backend diagnostics on the server.
#
# Usage:
#   sudo bash /opt/cryptoprocessing/ops/ubuntu/check-backend.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
BACKEND_SERVICE="${BACKEND_SERVICE:-cryptoprocessing.service}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/v1/health}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root: sudo bash ops/ubuntu/check-backend.sh"
    exit 1
  fi
}

require_root

log "systemd status"
systemctl status "${BACKEND_SERVICE}" --no-pager -l || true

log "listening on :8000"
ss -tlnp | grep ':8000' || echo "nothing listening on port 8000"

log "uvicorn processes"
ps aux | grep -E '[u]vicorn app.main:app' || echo "no uvicorn process found"

log "backend import test (production .env)"
if [[ ! -f "${APP_DIR}/.env" ]]; then
  echo "Missing ${APP_DIR}/.env" >&2
else
  sudo -u "${APP_USER}" bash -lc "
    set -euo pipefail
    cd '${APP_DIR}/backend'
    set -a
    source '${APP_DIR}/.env'
    set +a
    ./.venv/bin/python -c 'from app.main import app; print(\"backend import ok\")'
  " || true
fi

log "health check ${HEALTH_URL}"
curl -fsS "${HEALTH_URL}" && printf '\n' || echo "health check failed"

log "recent backend logs"
journalctl -u "${BACKEND_SERVICE}" -n 60 --no-pager || true
