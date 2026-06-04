#!/usr/bin/env bash
# One-command first-time server setup for Ubuntu 22.04/24.04.
#
# Minimal run (passwords are generated and printed at the end):
#   sudo DOMAIN=your-domain.com bash ops/ubuntu/setup-server.sh
#
# With explicit admin email:
#   sudo DOMAIN=your-domain.com SUPERADMIN_EMAIL=admin@your-domain.com bash ops/ubuntu/setup-server.sh
#
# Production with Cloudflare Origin Certificate:
#   sudo DOMAIN=your-domain.com \
#        SSL_MODE=cloudflare_origin \
#        CLOUDFLARE_ORIGIN_CERT_PATH=/etc/ssl/cloudflare/your-domain.com.pem \
#        CLOUDFLARE_ORIGIN_KEY_PATH=/etc/ssl/cloudflare/your-domain.com.key \
#        bash ops/ubuntu/setup-server.sh

set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
DOMAIN="${DOMAIN:-}"
DOMAIN_ALIASES="${DOMAIN_ALIASES:-}"
GIT_REPO="${GIT_REPO:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SSL_MODE="${SSL_MODE:-none}"
ENABLE_SSL="${ENABLE_SSL:-1}"
SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-}"
SUPERADMIN_FULL_NAME="${SUPERADMIN_FULL_NAME:-Platform Admin}"
CRYPTO_CASH_PUBLIC_KEY="${CRYPTO_CASH_PUBLIC_KEY:-}"
CRYPTO_CASH_SECRET_KEY="${CRYPTO_CASH_SECRET_KEY:-}"
CREDENTIALS_FILE="${CREDENTIALS_FILE:-/root/cryptoprocessing-credentials.txt}"

GENERATED_DB_PASSWORD=""
GENERATED_ADMIN_PASSWORD=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root: sudo bash ops/ubuntu/setup-server.sh"
    exit 1
  fi
}

generate_password() {
  openssl rand -hex 16
}

set_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  ENV_VALUE="${value}" python3 - "${env_file}" "${key}" <<'PY'
import os
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
value = os.environ["ENV_VALUE"]
text = path.read_text(encoding="utf-8")
pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
line = f"{key}={value}"
if pattern.search(text):
    text = pattern.sub(line, text, count=1)
else:
    if text and not text.endswith("\n"):
        text += "\n"
    text += line + "\n"
path.write_text(text, encoding="utf-8")
PY
}

ensure_repo() {
  if [[ -d "${APP_DIR}/backend" && -d "${APP_DIR}/frontend" ]]; then
    log "Using existing app directory ${APP_DIR}"
    return
  fi

  if [[ -z "${GIT_REPO}" ]]; then
    echo "App directory ${APP_DIR} is missing backend/frontend."
    echo "Either copy the repository to ${APP_DIR} or set GIT_REPO=https://github.com/..."
    exit 1
  fi

  log "Cloning ${GIT_REPO} (branch ${GIT_BRANCH}) into ${APP_DIR}"
  mkdir -p "$(dirname "${APP_DIR}")"
  if [[ -d "${APP_DIR}/.git" ]]; then
    echo "Directory ${APP_DIR} exists but is incomplete. Remove it or fix manually."
    exit 1
  fi
  git clone --branch "${GIT_BRANCH}" --depth 1 "${GIT_REPO}" "${APP_DIR}"
}

create_env_if_missing() {
  local env_file="${APP_DIR}/.env"
  local env_example="${APP_DIR}/ops/ubuntu/.env.production.example"
  local env_fallback="${APP_DIR}/.env.example"

  if [[ -f "${env_file}" ]]; then
    return
  fi

  log "Creating ${env_file} from template"
  if [[ -f "${env_example}" ]]; then
    cp "${env_example}" "${env_file}"
  elif [[ -f "${env_fallback}" ]]; then
    cp "${env_fallback}" "${env_file}"
  else
    echo "Missing ${env_example} and ${env_fallback}."
    exit 1
  fi

  local random_secret
  random_secret="$(openssl rand -hex 32)"
  set_env_value "${env_file}" "APP_ENV" "production"
  set_env_value "${env_file}" "ALLOW_INSECURE_DEFAULTS_IN_LOCAL" "false"
  set_env_value "${env_file}" "POSTGRES_HOST" "localhost"
  set_env_value "${env_file}" "POSTGRES_USER" "cryptoprocessing"
  set_env_value "${env_file}" "POSTGRES_DB" "cryptoprocessing"
  set_env_value "${env_file}" "REDIS_URL" "redis://127.0.0.1:6379/0"
  set_env_value "${env_file}" "SECRET_KEY" "${random_secret}"
  set_env_value "${env_file}" "JWT_SECRET_KEY" "${random_secret}"
  set_env_value "${env_file}" "FERNET_SECRET_KEY" "${random_secret}"
  set_env_value "${env_file}" "WEBHOOK_SECRET_KEY" "${random_secret}"
  chmod 600 "${env_file}"
}

configure_env() {
  local env_file="${APP_DIR}/.env"

  if [[ -z "${DOMAIN}" ]]; then
    echo "DOMAIN is required."
    echo "Example: sudo DOMAIN=your-domain.com bash ops/ubuntu/setup-server.sh"
    exit 1
  fi

  create_env_if_missing

  if [[ -z "${SUPERADMIN_EMAIL}" ]]; then
    SUPERADMIN_EMAIL="admin@${DOMAIN}"
  fi

  local db_pass admin_pass
  db_pass="$(grep -E '^POSTGRES_PASSWORD=' "${env_file}" | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "${db_pass}" || "${db_pass}" == replace-with-* ]]; then
    db_pass="$(generate_password)"
    GENERATED_DB_PASSWORD="${db_pass}"
  fi

  admin_pass="${SUPERADMIN_PASSWORD}"
  if [[ -z "${admin_pass}" || "${admin_pass}" == replace-with-* ]]; then
    admin_pass="$(generate_password)"
    GENERATED_ADMIN_PASSWORD="${admin_pass}"
  fi

  log "Applying production values to ${env_file}"
  set_env_value "${env_file}" "APP_ENV" "production"
  set_env_value "${env_file}" "ALLOW_INSECURE_DEFAULTS_IN_LOCAL" "false"
  set_env_value "${env_file}" "POSTGRES_HOST" "localhost"
  set_env_value "${env_file}" "POSTGRES_USER" "cryptoprocessing"
  set_env_value "${env_file}" "POSTGRES_DB" "cryptoprocessing"
  set_env_value "${env_file}" "POSTGRES_PASSWORD" "${db_pass}"
  set_env_value "${env_file}" "REDIS_URL" "redis://127.0.0.1:6379/0"
  set_env_value "${env_file}" "SUPERADMIN_EMAIL" "${SUPERADMIN_EMAIL}"
  set_env_value "${env_file}" "SUPERADMIN_PASSWORD" "${admin_pass}"
  set_env_value "${env_file}" "SUPERADMIN_FULL_NAME" "${SUPERADMIN_FULL_NAME}"
  set_env_value "${env_file}" "PUBLIC_API_BASE_URL" "https://${DOMAIN}"
  set_env_value "${env_file}" "PUBLIC_PAY_BASE_URL" "https://${pay_domain}"

  local docs_domain="${DOCS_DOMAIN:-docs.${DOMAIN}}"
  local admin_domain="${ADMIN_DOMAIN:-admin.${DOMAIN}}"
  local pay_domain="${PAY_DOMAIN:-pay.${DOMAIN}}"
  local cors="https://${DOMAIN},https://${docs_domain},https://${admin_domain},https://${pay_domain}"
  if [[ -n "${DOMAIN_ALIASES}" ]]; then
    IFS=',' read -ra aliases <<< "${DOMAIN_ALIASES}"
    for raw_alias in "${aliases[@]}"; do
      local alias_name
      alias_name="$(echo "${raw_alias}" | xargs)"
      if [[ -n "${alias_name}" ]]; then
        cors="${cors},https://${alias_name}"
      fi
    done
  elif [[ "${DOMAIN}" != www.* ]]; then
    cors="${cors},https://www.${DOMAIN}"
  fi
  set_env_value "${env_file}" "BACKEND_CORS_ORIGINS" "${cors}"

  if [[ -n "${CRYPTO_CASH_PUBLIC_KEY}" ]]; then
    set_env_value "${env_file}" "CRYPTO_CASH_PUBLIC_KEY" "${CRYPTO_CASH_PUBLIC_KEY}"
  fi
  if [[ -n "${CRYPTO_CASH_SECRET_KEY}" ]]; then
    set_env_value "${env_file}" "CRYPTO_CASH_SECRET_KEY" "${CRYPTO_CASH_SECRET_KEY}"
  fi
  if [[ -n "${CRYPTO_CASH_PUBLIC_KEY}" && -n "${CRYPTO_CASH_SECRET_KEY}" ]]; then
    set_env_value "${env_file}" "PAYMENT_PROVIDER" "crypto_cash"
  fi

  chown "${APP_USER}:${APP_USER}" "${env_file}" 2>/dev/null || true
  chmod 600 "${env_file}"

  # Keep for summary even if user supplied passwords explicitly.
  if [[ -z "${GENERATED_DB_PASSWORD}" ]]; then
    GENERATED_DB_PASSWORD="${db_pass}"
  fi
  if [[ -z "${GENERATED_ADMIN_PASSWORD}" ]]; then
    GENERATED_ADMIN_PASSWORD="${admin_pass}"
  fi
}

save_credentials() {
  umask 077
  cat >"${CREDENTIALS_FILE}" <<EOF
CryptoProcessing credentials
Generated: $(date -Iseconds)
Domain: ${DOMAIN}
Admin email: ${SUPERADMIN_EMAIL}
Admin password: ${GENERATED_ADMIN_PASSWORD}
PostgreSQL user: cryptoprocessing
PostgreSQL database: cryptoprocessing
PostgreSQL password: ${GENERATED_DB_PASSWORD}
Env file: ${APP_DIR}/.env
EOF
  chmod 600 "${CREDENTIALS_FILE}"
}

run_deploy() {
  log "Running full deploy"
  DOMAIN="${DOMAIN}" \
    DOMAIN_ALIASES="${DOMAIN_ALIASES}" \
    DOCS_DOMAIN="${DOCS_DOMAIN:-docs.${DOMAIN}}" \
    ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${DOMAIN}}" \
    PAY_DOMAIN="${PAY_DOMAIN:-pay.${DOMAIN}}" \
    APP_DIR="${APP_DIR}" \
    APP_USER="${APP_USER}" \
    SSL_MODE="${SSL_MODE}" \
    ENABLE_SSL="${ENABLE_SSL}" \
    bash "${APP_DIR}/ops/ubuntu/deploy.sh"
}

print_summary() {
  cat <<EOF

========================================
Setup completed
========================================
App dir:  ${APP_DIR}
Domain:   ${DOMAIN}

ADMIN PANEL LOGIN
  Email:    ${SUPERADMIN_EMAIL}
  Password: ${GENERATED_ADMIN_PASSWORD}

POSTGRESQL
  Host:     localhost
  Database: cryptoprocessing
  User:     cryptoprocessing
  Password: ${GENERATED_DB_PASSWORD}

Credentials saved to: ${CREDENTIALS_FILE}
Store this file securely and delete it after copying passwords.

Checks:
  systemctl status cryptoprocessing --no-pager
  curl -fsS http://127.0.0.1:8000/api/v1/health

Update after git pull:
  sudo bash ${APP_DIR}/ops/ubuntu/update-server.sh

EOF
}

main() {
  require_root

  if [[ -d "${REPO_ROOT}/backend" && -d "${REPO_ROOT}/frontend" && "${REPO_ROOT}" != "${APP_DIR}" ]]; then
    if [[ ! -d "${APP_DIR}/backend" ]]; then
      log "Copying repository from ${REPO_ROOT} to ${APP_DIR}"
      mkdir -p "${APP_DIR}"
      rsync -a --delete \
        --exclude node_modules \
        --exclude backend/.venv \
        --exclude frontend/dist \
        --exclude .git \
        "${REPO_ROOT}/" "${APP_DIR}/"
    fi
  else
    ensure_repo
  fi

  chmod +x "${APP_DIR}/ops/ubuntu/deploy.sh" "${APP_DIR}/ops/ubuntu/restart_app.sh" "${APP_DIR}/ops/ubuntu/update-server.sh" 2>/dev/null || true
  configure_env
  run_deploy
  save_credentials
  print_summary
}

main "$@"
