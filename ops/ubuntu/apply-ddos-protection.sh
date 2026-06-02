#!/usr/bin/env bash
# Apply nginx DDoS limits + regenerate vhost (safe on already deployed servers).
#
# Usage:
#   sudo DOMAIN=noren.digital bash /opt/cryptoprocessing/ops/ubuntu/apply-ddos-protection.sh
#
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
DOMAIN="${DOMAIN:-noren.digital}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash ops/ubuntu/apply-ddos-protection.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=nginx-ddos-lib.sh
source "${SCRIPT_DIR}/nginx-ddos-lib.sh"

echo "[1/3] Installing nginx limit zones (conf.d)..."
nginx_install_ddos_conf_files "${APP_DIR}"

echo "[2/3] Regenerating nginx vhost for ${DOMAIN}..."
nginx_regenerate_vhost "${DOMAIN}" "${APP_DIR}"

echo "[3/3] Testing and reloading nginx..."
nginx -t
systemctl reload nginx

echo
echo "DDoS nginx protection applied."
echo "Next: configure Cloudflare rules — see ops/ubuntu/CLOUDFLARE-DDOS.md"
echo "Optional: set UVICORN_WORKERS=2 in ${APP_DIR}/.env and restart cryptoprocessing."
