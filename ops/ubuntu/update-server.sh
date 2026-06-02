#!/usr/bin/env bash
# Update already deployed server: pull latest code, rebuild, migrate, restart.
#
# Usage:
#   sudo bash /opt/cryptoprocessing/ops/ubuntu/update-server.sh
#
# Optional:
#   APP_DIR=/opt/cryptoprocessing GIT_BRANCH=main bash ops/ubuntu/update-server.sh

set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root: sudo bash ops/ubuntu/update-server.sh"
    exit 1
  fi
}

pull_latest() {
  if [[ "${SKIP_GIT_PULL}" == "1" ]]; then
    log "Skipping git pull (SKIP_GIT_PULL=1)"
    return
  fi
  if [[ ! -d "${APP_DIR}/.git" ]]; then
    log "No git repo in ${APP_DIR}; skipping pull"
    return
  fi
  log "Pulling latest code (${GIT_BRANCH})"
  sudo -u "${APP_USER}" bash -lc "
    set -euo pipefail
    cd '${APP_DIR}'
    git fetch origin '${GIT_BRANCH}'
    git checkout '${GIT_BRANCH}'
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo 'Local changes in tracked files will be reset to origin/${GIT_BRANCH} (.env is not affected).'
      git status --short
    fi
    git reset --hard 'origin/${GIT_BRANCH}'
  "
}

install_backend_deps() {
  log "Updating backend dependencies"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/pip install -r requirements.txt"
}

install_frontend_deps() {
  log "Updating frontend dependencies"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/frontend' && npm ci"
}

main() {
  require_root
  [[ -d "${APP_DIR}/backend" ]] || { echo "Missing ${APP_DIR}/backend"; exit 1; }
  [[ -d "${APP_DIR}/frontend" ]] || { echo "Missing ${APP_DIR}/frontend"; exit 1; }

  pull_latest
  install_backend_deps
  install_frontend_deps
  APP_DIR="${APP_DIR}" APP_USER="${APP_USER}" bash "${APP_DIR}/ops/ubuntu/restart_app.sh"
}

main "$@"
