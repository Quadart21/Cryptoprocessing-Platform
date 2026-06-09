#!/usr/bin/env bash
# Apply nginx DDoS limits on site server (split deployment).
#
# Usage:
#   sudo DOMAIN=noren.digital API_UPSTREAM=2.26.90.43:8000 \
#        bash /opt/cryptoprocessing/ops/ubuntu/apply-site-ddos-protection.sh
#
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
DOMAIN="${DOMAIN:-noren.digital}"
API_UPSTREAM="${API_UPSTREAM:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=nginx-site-lib.sh
source "${SCRIPT_DIR}/nginx-site-lib.sh"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

if [[ -z "${API_UPSTREAM}" ]]; then
  echo "API_UPSTREAM is required (example: 2.26.90.43:8000)."
  exit 1
fi

echo "[1/2] Installing nginx limit zones and site vhost..."
nginx_install_site_vhost "${DOMAIN}" "${APP_DIR}" "${API_UPSTREAM}"

echo "[2/2] Testing and reloading nginx..."
nginx -t
systemctl reload nginx

echo
echo "Site DDoS nginx protection applied."
echo "Configure Cloudflare rules: ops/ubuntu/CLOUDFLARE-DDOS.md"
