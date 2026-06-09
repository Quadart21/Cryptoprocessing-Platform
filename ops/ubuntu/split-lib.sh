#!/usr/bin/env bash
# Shared helpers for split (DB / API / site) deployment scripts.

split_log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

split_require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run as root."
    exit 1
  fi
}

split_generate_password() {
  openssl rand -hex 16
}

split_set_env_value() {
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

split_build_cors_origins() {
  local domain="$1"
  local docs_domain="${2:-docs.${domain}}"
  local admin_domain="${3:-admin.${domain}}"
  local pay_domain="${4:-pay.${domain}}"
  local app_domain="${5:-app.${domain}}"
  local api_domain="${6:-api.${domain}}"
  local domain_aliases="${7:-}"
  local cors="https://${domain},https://${app_domain},https://${docs_domain},https://${admin_domain},https://${pay_domain},https://${api_domain}"
  if [[ -n "${domain_aliases}" ]]; then
    IFS=',' read -ra aliases <<< "${domain_aliases}"
    for raw_alias in "${aliases[@]}"; do
      local alias_name
      alias_name="$(echo "${raw_alias}" | xargs)"
      if [[ -n "${alias_name}" ]]; then
        cors="${cors},https://${alias_name}"
      fi
    done
  elif [[ "${domain}" != www.* ]]; then
    cors="${cors},https://www.${domain}"
  fi
  echo "${cors}"
}

split_install_node22_if_needed() {
  local need_node_install="0"
  if ! command -v node >/dev/null 2>&1; then
    need_node_install="1"
  else
    local node_major
    node_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [[ "${node_major}" -lt 20 ]]; then
      need_node_install="1"
    fi
  fi
  if [[ "${need_node_install}" == "1" ]]; then
    split_log "Installing Node.js 22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    split_log "Node.js already installed: $(node -v)"
  fi
}

split_write_frontend_env_production() {
  local frontend_dir="$1"
  local domain="$2"
  local env_file="${frontend_dir}/.env.production"
  cat >"${env_file}" <<EOF
VITE_API_BASE_URL=https://api.${domain}/api/v1
VITE_MAIN_SITE_URL=https://${domain}
VITE_ADMIN_SITE_URL=https://admin.${domain}
VITE_APP_SITE_URL=https://app.${domain}
VITE_DOCS_SITE_URL=https://docs.${domain}
VITE_PAY_SITE_URL=https://pay.${domain}
EOF
  chown "${APP_USER:-cryptoprocessing}:${APP_USER:-cryptoprocessing}" "${env_file}" 2>/dev/null || true
}

split_install_systemd_remote_units() {
  local app_dir="$1"
  install -m 644 "${app_dir}/ops/ubuntu/cryptoprocessing-remote.service" /etc/systemd/system/cryptoprocessing.service
  install -m 644 "${app_dir}/ops/ubuntu/cryptoprocessing-celery-worker-remote.service" /etc/systemd/system/cryptoprocessing-celery-worker.service
  install -m 644 "${app_dir}/ops/ubuntu/cryptoprocessing-celery-beat-remote.service" /etc/systemd/system/cryptoprocessing-celery-beat.service
  systemctl daemon-reload
}

# Always allow SSH before enabling UFW (default deny blocks port 22 otherwise).
split_ufw_allow_ssh() {
  if ! command -v ufw >/dev/null 2>&1; then
    return 0
  fi
  if ufw status numbered 2>/dev/null | grep -qE '[[:space:]]22(/tcp)?[[:space:]]'; then
    return 0
  fi
  ufw allow 22/tcp
}

split_ufw_allow_from_to_port() {
  local source_ip="$1"
  local port="$2"
  if [[ -z "${source_ip}" || -z "${port}" ]]; then
    echo "UFW: skip empty source_ip or port (from=${source_ip} port=${port})" >&2
    return 1
  fi
  ufw allow from "${source_ip}" to any port "${port}"
}

split_ufw_enable() {
  split_ufw_allow_ssh
  ufw --force enable
}
