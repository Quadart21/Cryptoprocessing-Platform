#!/usr/bin/env bash
# API + Redis + Celery server (remote PostgreSQL) for split deployment.
#
# Usage:
#   sudo DOMAIN=noren.digital \
#        POSTGRES_HOST=2.26.88.44 \
#        POSTGRES_PASSWORD='...' \
#        SITE_SERVER_IP=2.26.9.49 \
#        bash ops/ubuntu/setup-api.sh
#
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
DOMAIN="${DOMAIN:-noren.digital}"
DOMAIN_ALIASES="${DOMAIN_ALIASES:-www.${DOMAIN}}"
POSTGRES_HOST="${POSTGRES_HOST:-}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-cryptoprocessing}"
POSTGRES_USER="${POSTGRES_USER:-cryptoprocessing}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
SITE_SERVER_IP="${SITE_SERVER_IP:-}"
SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-}"
SUPERADMIN_FULL_NAME="${SUPERADMIN_FULL_NAME:-Platform Admin}"
GIT_REPO="${GIT_REPO:-https://github.com/Quadart21/Cryptoprocessing-Platform.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
ENABLE_SSL="${ENABLE_SSL:-1}"
SSL_MODE="${SSL_MODE:-cloudflare_origin}"
CLOUDFLARE_ORIGIN_CERT_PATH="${CLOUDFLARE_ORIGIN_CERT_PATH:-/etc/ssl/cloudflare/${DOMAIN}.pem}"
CLOUDFLARE_ORIGIN_KEY_PATH="${CLOUDFLARE_ORIGIN_KEY_PATH:-/etc/ssl/cloudflare/${DOMAIN}.key}"
ENABLE_UFW="${ENABLE_UFW:-1}"
API_DOMAIN="${API_DOMAIN:-api.${DOMAIN}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=split-lib.sh
source "${SCRIPT_DIR}/split-lib.sh"
# shellcheck source=nginx-site-lib.sh
source "${SCRIPT_DIR}/nginx-site-lib.sh"

ensure_repo() {
  if [[ -d "${APP_DIR}/backend" && -d "${APP_DIR}/frontend" ]]; then
    split_log "Using existing app directory ${APP_DIR}"
    return
  fi
  split_log "Cloning ${GIT_REPO} (${GIT_BRANCH})"
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --branch "${GIT_BRANCH}" --depth 1 "${GIT_REPO}" "${APP_DIR}"
}

configure_env() {
  local env_file="${APP_DIR}/.env"
  local env_example="${APP_DIR}/ops/ubuntu/.env.production.example"
  if [[ ! -f "${env_file}" ]]; then
    cp "${env_example}" "${env_file}"
  fi

  if [[ -z "${POSTGRES_HOST}" || -z "${POSTGRES_PASSWORD}" ]]; then
    echo "POSTGRES_HOST and POSTGRES_PASSWORD are required."
    exit 1
  fi

  if [[ -z "${SUPERADMIN_EMAIL}" ]]; then
    SUPERADMIN_EMAIL="admin@${DOMAIN}"
  fi
  if [[ -z "${SUPERADMIN_PASSWORD}" ]]; then
    SUPERADMIN_PASSWORD="$(split_generate_password)"
    split_log "Generated SUPERADMIN_PASSWORD: ${SUPERADMIN_PASSWORD}"
  fi

  local random_secret cors pay_domain
  random_secret="$(openssl rand -hex 32)"
  pay_domain="${PAY_DOMAIN:-pay.${DOMAIN}}"
  cors="$(split_build_cors_origins "${DOMAIN}" "docs.${DOMAIN}" "admin.${DOMAIN}" "${pay_domain}" "app.${DOMAIN}" "${API_DOMAIN}" "${DOMAIN_ALIASES}")"

  split_set_env_value "${env_file}" "APP_ENV" "production"
  split_set_env_value "${env_file}" "ALLOW_INSECURE_DEFAULTS_IN_LOCAL" "false"
  split_set_env_value "${env_file}" "POSTGRES_HOST" "${POSTGRES_HOST}"
  split_set_env_value "${env_file}" "POSTGRES_PORT" "${POSTGRES_PORT}"
  split_set_env_value "${env_file}" "POSTGRES_DB" "${POSTGRES_DB}"
  split_set_env_value "${env_file}" "POSTGRES_USER" "${POSTGRES_USER}"
  split_set_env_value "${env_file}" "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
  split_set_env_value "${env_file}" "REDIS_URL" "redis://127.0.0.1:6379/0"
  split_set_env_value "${env_file}" "PUBLIC_API_BASE_URL" "https://${API_DOMAIN}"
  split_set_env_value "${env_file}" "PUBLIC_PAY_BASE_URL" "https://${pay_domain}"
  split_set_env_value "${env_file}" "BACKEND_CORS_ORIGINS" "${cors}"
  split_set_env_value "${env_file}" "SECRET_KEY" "${random_secret}"
  split_set_env_value "${env_file}" "JWT_SECRET_KEY" "${random_secret}"
  split_set_env_value "${env_file}" "FERNET_SECRET_KEY" "${random_secret}"
  split_set_env_value "${env_file}" "WEBHOOK_SECRET_KEY" "${random_secret}"
  split_set_env_value "${env_file}" "SUPERADMIN_EMAIL" "${SUPERADMIN_EMAIL}"
  split_set_env_value "${env_file}" "SUPERADMIN_PASSWORD" "${SUPERADMIN_PASSWORD}"
  split_set_env_value "${env_file}" "SUPERADMIN_FULL_NAME" "${SUPERADMIN_FULL_NAME}"

  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --create-home --shell /bin/bash "${APP_USER}"
  fi
  chown "${APP_USER}:${APP_USER}" "${env_file}"
  chmod 600 "${env_file}"
}

main() {
  split_require_root

  if [[ -z "${DOMAIN}" ]]; then
    echo "DOMAIN is required."
    exit 1
  fi

  ensure_repo
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

  split_log "Installing packages"
  apt-get update
  apt-get install -y ca-certificates curl git gnupg nginx openssl python3 python3-pip python3-venv redis-server sudo
  systemctl enable --now redis-server

  configure_env
  split_install_node22_if_needed
  split_write_frontend_env_production "${APP_DIR}/frontend" "${DOMAIN}"

  split_log "Installing backend and building frontend (SEO on /)"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && python3 -m venv .venv && ./.venv/bin/pip install --upgrade pip && ./.venv/bin/pip install -r requirements.txt"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/frontend' && npm ci && npm run build"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/alembic upgrade head"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/python -m app.scripts.seed_superadmin"

  split_log "Installing systemd units"
  split_install_systemd_remote_units "${APP_DIR}"
  systemctl enable --now cryptoprocessing cryptoprocessing-celery-worker cryptoprocessing-celery-beat

  if [[ "${ENABLE_SSL}" == "1" && "${SSL_MODE}" == "cloudflare_origin" ]]; then
    if [[ ! -f "${CLOUDFLARE_ORIGIN_CERT_PATH}" || ! -f "${CLOUDFLARE_ORIGIN_KEY_PATH}" ]]; then
      echo "Cloudflare Origin cert/key not found at ${CLOUDFLARE_ORIGIN_CERT_PATH}"
      echo "Set ENABLE_SSL=0 for HTTP-only bootstrap or place certificates first."
      exit 1
    fi
  fi

  split_log "Installing nginx vhost for ${API_DOMAIN}"
  nginx_install_api_vhost "${DOMAIN}" "${CLOUDFLARE_ORIGIN_CERT_PATH}" "${CLOUDFLARE_ORIGIN_KEY_PATH}" "${APP_DIR}"
  nginx -t
  systemctl reload nginx

  if [[ "${ENABLE_UFW}" == "1" ]] && command -v ufw >/dev/null 2>&1; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    if [[ -n "${SITE_SERVER_IP}" ]]; then
      ufw allow from "${SITE_SERVER_IP}" to any port 8000 proto tcp
    fi
    ufw --force enable
  fi

  curl -fsS http://127.0.0.1:8000/api/v1/health

  cat <<EOF

========================================
API server ready
========================================
Domain:        ${API_DOMAIN}
Admin email:   ${SUPERADMIN_EMAIL}
Admin password: ${SUPERADMIN_PASSWORD}
PostgreSQL:    ${POSTGRES_HOST}:${POSTGRES_PORT}
Webhook URL:   https://${API_DOMAIN}/internal/webhook/crypto-cash

Checks:
  systemctl status cryptoprocessing --no-pager
  curl -fsS https://${API_DOMAIN}/api/v1/health

EOF
}

main "$@"
