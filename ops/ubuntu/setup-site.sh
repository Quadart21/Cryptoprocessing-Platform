#!/usr/bin/env bash
# Frontend + nginx site server (proxies to remote API) for split deployment.
#
# Usage:
#   sudo DOMAIN=noren.digital \
#        API_UPSTREAM=2.26.90.43:8000 \
#        bash ops/ubuntu/setup-site.sh
#
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
DOMAIN="${DOMAIN:-noren.digital}"
DOMAIN_ALIASES="${DOMAIN_ALIASES:-www.${DOMAIN}}"
API_UPSTREAM="${API_UPSTREAM:-}"
GIT_REPO="${GIT_REPO:-https://github.com/Quadart21/Cryptoprocessing-Platform.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
ENABLE_SSL="${ENABLE_SSL:-1}"
SSL_MODE="${SSL_MODE:-cloudflare_origin}"
CLOUDFLARE_ORIGIN_CERT_PATH="${CLOUDFLARE_ORIGIN_CERT_PATH:-/etc/ssl/cloudflare/${DOMAIN}.pem}"
CLOUDFLARE_ORIGIN_KEY_PATH="${CLOUDFLARE_ORIGIN_KEY_PATH:-/etc/ssl/cloudflare/${DOMAIN}.key}"
ENABLE_UFW="${ENABLE_UFW:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=split-lib.sh
source "${SCRIPT_DIR}/split-lib.sh"
# shellcheck source=nginx-site-lib.sh
source "${SCRIPT_DIR}/nginx-site-lib.sh"

ensure_repo() {
  if [[ -d "${APP_DIR}/frontend" ]]; then
    split_log "Using existing app directory ${APP_DIR}"
    return
  fi
  split_log "Cloning ${GIT_REPO} (${GIT_BRANCH})"
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --branch "${GIT_BRANCH}" --depth 1 "${GIT_REPO}" "${APP_DIR}"
}

main() {
  split_require_root

  if [[ -z "${DOMAIN}" || -z "${API_UPSTREAM}" ]]; then
    echo "DOMAIN and API_UPSTREAM are required."
    echo "Example: sudo DOMAIN=noren.digital API_UPSTREAM=2.26.90.43:8000 bash ops/ubuntu/setup-site.sh"
    exit 1
  fi

  ensure_repo
  split_ensure_app_user "${APP_USER}"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

  split_log "Installing packages"
  apt-get update
  apt-get install -y ca-certificates curl git gnupg nginx openssl sudo
  split_install_node22_if_needed
  split_write_frontend_env_production "${APP_DIR}/frontend" "${DOMAIN}"

  split_log "Building frontend"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/frontend' && npm ci && npm run build"

  if [[ "${ENABLE_SSL}" == "1" && "${SSL_MODE}" == "cloudflare_origin" ]]; then
    if [[ ! -f "${CLOUDFLARE_ORIGIN_CERT_PATH}" || ! -f "${CLOUDFLARE_ORIGIN_KEY_PATH}" ]]; then
      echo "Cloudflare Origin cert/key not found at ${CLOUDFLARE_ORIGIN_CERT_PATH}"
      echo "Set ENABLE_SSL=0 for HTTP-only bootstrap or place certificates first."
      exit 1
    fi
  fi

  split_log "Installing nginx site vhost (upstream ${API_UPSTREAM})"
  nginx_install_site_vhost "${DOMAIN}" "${APP_DIR}" "${API_UPSTREAM}" "${DOMAIN_ALIASES}" \
    "${CLOUDFLARE_ORIGIN_CERT_PATH}" "${CLOUDFLARE_ORIGIN_KEY_PATH}"
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx

  if [[ "${ENABLE_UFW}" == "1" ]] && command -v ufw >/dev/null 2>&1; then
    split_ufw_allow_ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    split_ufw_enable
  fi

  cat <<EOF

========================================
Site server ready
========================================
Domain:       ${DOMAIN}
API upstream: ${API_UPSTREAM}
Static root:  ${APP_DIR}/frontend/dist

Checks:
  curl -fsSI https://${DOMAIN}/
  curl -fsS https://api.${DOMAIN}/api/v1/health

Update:
  sudo bash ${APP_DIR}/ops/ubuntu/update-server-site.sh

EOF
}

main "$@"
