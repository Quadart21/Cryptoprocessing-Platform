#!/usr/bin/env bash
# Update site server in split deployment.
#
# Usage:
#   sudo API_UPSTREAM=2.26.90.43:8000 bash /opt/cryptoprocessing/ops/ubuntu/update-server-site.sh
#
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
API_UPSTREAM="${API_UPSTREAM:-}"
DOMAIN="${DOMAIN:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=split-lib.sh
source "${SCRIPT_DIR}/split-lib.sh"
# shellcheck source=nginx-site-lib.sh
source "${SCRIPT_DIR}/nginx-site-lib.sh"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

if [[ -z "${DOMAIN}" ]]; then
  DOMAIN="$(grep -E '^VITE_MAIN_SITE_URL=' "${APP_DIR}/frontend/.env.production" 2>/dev/null | tail -n1 | sed -E 's#^VITE_MAIN_SITE_URL=https?://([^/]+).*#\1#' || true)"
fi
DOMAIN="${DOMAIN:-noren.digital}"

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

split_write_frontend_env_production "${APP_DIR}/frontend" "${DOMAIN}"
split_log "Building frontend"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/frontend' && npm ci && npm run build"

if [[ -n "${API_UPSTREAM}" ]]; then
  split_log "Regenerating nginx vhost (upstream ${API_UPSTREAM})"
  nginx_install_site_vhost "${DOMAIN}" "${APP_DIR}" "${API_UPSTREAM}"
fi

nginx -t
systemctl reload nginx
split_log "Site server update completed"
