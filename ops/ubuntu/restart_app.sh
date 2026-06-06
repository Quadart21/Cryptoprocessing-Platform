#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
BACKEND_SERVICE="${BACKEND_SERVICE:-cryptoprocessing.service}"
CELERY_WORKER_SERVICE="${CELERY_WORKER_SERVICE:-cryptoprocessing-celery-worker.service}"
CELERY_BEAT_SERVICE="${CELERY_BEAT_SERVICE:-cryptoprocessing-celery-beat.service}"
RELOAD_NGINX="${RELOAD_NGINX:-1}"
# 0 — пропустить миграции (например, временно недоступна БД)
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"
# 0 — пропустить проверку/создание недостающих ORM-таблиц
SKIP_SCHEMA_SYNC="${SKIP_SCHEMA_SYNC:-0}"

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
  log "Checking backend syntax (compileall)"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/python -m compileall app"
}

check_backend_boot() {
  log "Checking backend application import (pydantic loads ${APP_DIR}/.env)"
  local env_file="${APP_DIR}/.env"
  [[ -f "${env_file}" ]] || { echo "Missing ${env_file}"; exit 1; }
  sudo -u "${APP_USER}" bash -lc "
    set -euo pipefail
    cd '${APP_DIR}/backend'
    ./.venv/bin/python -c 'from app.main import app; print(\"backend import ok\")'
  "
}

run_migrations() {
  if [[ "${SKIP_MIGRATIONS}" == "1" ]]; then
    log "Skipping DB migrations (SKIP_MIGRATIONS=1)"
    return
  fi
  log "Running Alembic migrations (upgrade head)"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/python -m alembic upgrade head"
}

sync_missing_tables() {
  if [[ "${SKIP_SCHEMA_SYNC}" == "1" ]]; then
    log "Skipping ORM table sync (SKIP_SCHEMA_SYNC=1)"
    return
  fi
  log "Checking ORM tables and creating missing ones"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/python -m app.scripts.sync_schema"
}

ensure_cors_origins() {
  local env_file="${APP_DIR}/.env"
  [[ -f "${env_file}" ]] || return 0

  local api_url
  api_url="$(grep -E '^PUBLIC_API_BASE_URL=' "${env_file}" | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
  local host="${api_url#https://}"
  host="${host#http://}"
  host="${host%%/*}"
  [[ -n "${host}" ]] || return 0

  local base_domain="${host#api.}"
  if [[ "${base_domain}" == "${host}" ]]; then
    base_domain="${host}"
  fi

  local origins=(
    "https://${base_domain}"
    "https://www.${base_domain}"
    "https://admin.${base_domain}"
    "https://app.${base_domain}"
    "https://pay.${base_domain}"
    "https://docs.${base_domain}"
  )
  if [[ "${host}" != "${base_domain}" ]]; then
    origins+=("https://${host}")
  fi

  local current
  current="$(grep -E '^BACKEND_CORS_ORIGINS=' "${env_file}" | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "${current}" ]]; then
    return 0
  fi

  local updated="${current}"
  local added=0
  local origin
  for origin in "${origins[@]}"; do
    if [[ ",${updated}," != *",${origin},"* ]]; then
      updated="${updated},${origin}"
      added=1
    fi
  done

  if [[ "${added}" -eq 1 ]]; then
    log "Patching BACKEND_CORS_ORIGINS (admin/app/pay/docs for ${base_domain})"
    sed -i "s#^BACKEND_CORS_ORIGINS=.*#BACKEND_CORS_ORIGINS=${updated}#" "${env_file}"
  else
    log "CORS already includes platform subdomains for ${base_domain}"
  fi
}

install_systemd_units() {
  if [[ -f "${APP_DIR}/ops/ubuntu/cryptoprocessing.service" ]]; then
    log "Installing systemd unit files"
    install -m 644 "${APP_DIR}/ops/ubuntu/cryptoprocessing.service" /etc/systemd/system/cryptoprocessing.service
    install -m 644 "${APP_DIR}/ops/ubuntu/cryptoprocessing-celery-worker.service" /etc/systemd/system/cryptoprocessing-celery-worker.service
    install -m 644 "${APP_DIR}/ops/ubuntu/cryptoprocessing-celery-beat.service" /etc/systemd/system/cryptoprocessing-celery-beat.service
    systemctl daemon-reload
  fi
}

restart_backend() {
  log "Restarting backend service ${BACKEND_SERVICE}"
  systemctl restart "${BACKEND_SERVICE}"
  sleep 5
  systemctl status "${BACKEND_SERVICE}" --no-pager -l
}

restart_celery_worker() {
  log "Restarting Celery worker service ${CELERY_WORKER_SERVICE}"
  systemctl restart "${CELERY_WORKER_SERVICE}"
  sleep 3
  systemctl status "${CELERY_WORKER_SERVICE}" --no-pager -l
}

restart_celery_beat() {
  log "Restarting Celery beat service ${CELERY_BEAT_SERVICE}"
  systemctl restart "${CELERY_BEAT_SERVICE}"
  sleep 3
  systemctl status "${CELERY_BEAT_SERVICE}" --no-pager -l
}

reload_nginx() {
  if [[ "${RELOAD_NGINX}" != "1" ]]; then
    return
  fi
  if [[ -f "${APP_DIR}/ops/ubuntu/nginx-ddos-lib.sh" ]]; then
    log "Applying nginx DDoS config (if present)"
    # shellcheck source=nginx-ddos-lib.sh
    source "${APP_DIR}/ops/ubuntu/nginx-ddos-lib.sh"
    domain="$(grep -E '^PUBLIC_API_BASE_URL=' "${APP_DIR}/.env" 2>/dev/null | tail -n1 | sed -E 's#^PUBLIC_API_BASE_URL=https?://([^/]+)/.*#\1#' || true)"
    domain="${domain:-noren.digital}"
    nginx_install_ddos_conf_files "${APP_DIR}" || true
    if [[ -f "/etc/nginx/sites-available/${domain}" ]]; then
      nginx_regenerate_vhost "${domain}" "${APP_DIR}" || true
    fi
  fi
  log "Reloading nginx"
  nginx -t
  systemctl reload nginx
}

smoke_check() {
  log "Running local health check"
  local url="http://127.0.0.1:8000/api/v1/health"
  local attempts=20
  local delay=2
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      curl -fsS "${url}"
      printf '\n'
      return 0
    fi
    if [[ "${attempt}" -lt "${attempts}" ]]; then
      sleep "${delay}"
    fi
  done
  echo "Health check failed after ${attempts} attempts (${url})" >&2
  systemctl status "${BACKEND_SERVICE}" --no-pager -l >&2 || true
  journalctl -u "${BACKEND_SERVICE}" -n 40 --no-pager >&2 || true
  exit 1
}

print_done() {
  log "Done"
  echo "Frontend rebuilt."
  if [[ "${SKIP_MIGRATIONS}" != "1" ]]; then
    echo "Database migrations applied (alembic upgrade head)."
  else
    echo "Database migrations skipped."
  fi
  if [[ "${SKIP_SCHEMA_SYNC}" != "1" ]]; then
    echo "ORM tables verified (missing tables created if needed)."
  else
    echo "ORM table sync skipped."
  fi
  echo "Backend restarted."
  echo "Celery worker restarted."
  echo "Celery beat restarted."
  if [[ "${RELOAD_NGINX}" == "1" ]]; then
    echo "Nginx reloaded."
  fi
}

require_root
require_paths
build_frontend
check_backend_syntax
check_backend_boot
run_migrations
sync_missing_tables
ensure_cors_origins
install_systemd_units
restart_backend
restart_celery_worker
restart_celery_beat
reload_nginx
smoke_check
print_done
