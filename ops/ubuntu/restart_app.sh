#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
BACKEND_SERVICE="${BACKEND_SERVICE:-cryptoprocessing.service}"
RELOAD_NGINX="${RELOAD_NGINX:-1}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root: sudo bash ops/ubuntu/restart_app.sh"
    exit 1
  fi
}

require_paths() {
  [[ -d "${APP_DIR}/frontend" ]] || { echo "Missing ${APP_DIR}/frontend"; exit 1; }
  [[ -d "${APP_DIR}/backend" ]] || { echo "Missing ${APP_DIR}/backend"; exit 1; }
  [[ -x "${APP_DIR}/backend/.venv/bin/python" ]] || {
    echo "Missing backend virtualenv: ${APP_DIR}/backend/.venv/bin/python"
    exit 1
  }
}

build_frontend() {
  log "Building frontend"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/frontend' && npm run build"
}

check_backend_syntax() {
  log "Checking backend imports"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/python -m compileall app"
}

restart_backend() {
  log "Restarting backend service ${BACKEND_SERVICE}"
  systemctl restart "${BACKEND_SERVICE}"
  sleep 3
  systemctl status "${BACKEND_SERVICE}" --no-pager -l
}

reload_nginx() {
  if [[ "${RELOAD_NGINX}" != "1" ]]; then
    return
  fi
  log "Reloading nginx"
  nginx -t
  systemctl reload nginx
}

smoke_check() {
  log "Running local health check"
  curl -fsS http://127.0.0.1:8000/api/v1/health
  printf '\n'
}

print_done() {
  log "Done"
  echo "Frontend rebuilt."
  echo "Backend restarted."
  if [[ "${RELOAD_NGINX}" == "1" ]]; then
    echo "Nginx reloaded."
  fi
}

require_root
require_paths
build_frontend
check_backend_syntax
restart_backend
reload_nginx
smoke_check
print_done
