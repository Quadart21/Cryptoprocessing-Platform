#!/usr/bin/env bash
# Update API server in split deployment.
#
# Usage:
#   sudo bash /opt/cryptoprocessing/ops/ubuntu/update-server-api.sh
#
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
RELOAD_NGINX="${RELOAD_NGINX:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=split-lib.sh
source "${SCRIPT_DIR}/split-lib.sh"
# shellcheck source=nginx-site-lib.sh
source "${SCRIPT_DIR}/nginx-site-lib.sh"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

if [[ "${SKIP_GIT_PULL}" != "1" && -d "${APP_DIR}/.git" ]]; then
  split_log "Pulling latest code"
  sudo -u "${APP_USER}" bash -lc "
    set -euo pipefail
    cd '${APP_DIR}'
    git fetch origin '${GIT_BRANCH}'
    git checkout '${GIT_BRANCH}'
    git reset --hard 'origin/${GIT_BRANCH}'
  "
fi

DOMAIN="$(grep -E '^PUBLIC_API_BASE_URL=' "${APP_DIR}/.env" 2>/dev/null | tail -n1 | sed -E 's#^PUBLIC_API_BASE_URL=https?://api\.([^/]+).*#\1#' || true)"
DOMAIN="${DOMAIN:-noren.digital}"

split_log "Updating backend dependencies"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/pip install -r requirements.txt"

split_write_frontend_env_production "${APP_DIR}/frontend" "${DOMAIN}"
split_log "Rebuilding frontend for API SEO"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/frontend' && npm ci && npm run build"

split_log "Running migrations"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/alembic upgrade head"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/python -m app.scripts.sync_schema"

split_install_systemd_remote_units "${APP_DIR}"
systemctl restart cryptoprocessing cryptoprocessing-celery-worker cryptoprocessing-celery-beat

if [[ "${RELOAD_NGINX}" == "1" ]]; then
  split_log "Reloading API nginx vhost"
  nginx_install_api_vhost "${DOMAIN}" "/etc/ssl/cloudflare/${DOMAIN}.pem" "/etc/ssl/cloudflare/${DOMAIN}.key" "${APP_DIR}"
  nginx -t
  systemctl reload nginx
fi

curl -fsS http://127.0.0.1:8000/api/v1/health
split_log "API server update completed"
