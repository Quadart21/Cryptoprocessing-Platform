#!/usr/bin/env bash
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

DOMAIN="${DOMAIN:-noren.digital}"
DOMAIN_ALIASES="${DOMAIN_ALIASES:-www.${DOMAIN}}"
DOCS_DOMAIN="${DOCS_DOMAIN:-docs.${DOMAIN}}"
APP_DIR="${APP_DIR:-/opt/cryptoprocessing}"
APP_USER="${APP_USER:-cryptoprocessing}"
ENABLE_SSL="${ENABLE_SSL:-1}"
SSL_MODE="${SSL_MODE:-cloudflare_origin}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
LETSENCRYPT_NO_EMAIL="${LETSENCRYPT_NO_EMAIL:-0}"
CLOUDFLARE_ORIGIN_CERT_PATH="${CLOUDFLARE_ORIGIN_CERT_PATH:-/etc/ssl/cloudflare/${DOMAIN}.pem}"
CLOUDFLARE_ORIGIN_KEY_PATH="${CLOUDFLARE_ORIGIN_KEY_PATH:-/etc/ssl/cloudflare/${DOMAIN}.key}"

build_server_names() {
  local names="${DOMAIN} ${DOCS_DOMAIN}"
  if [[ -n "${DOMAIN_ALIASES}" ]]; then
    IFS=',' read -ra aliases <<< "${DOMAIN_ALIASES}"
    for raw_alias in "${aliases[@]}"; do
      local alias_name
      alias_name="$(echo "${raw_alias}" | xargs)"
      if [[ -n "${alias_name}" && "${alias_name}" != "${DOMAIN}" ]]; then
        names="${names} ${alias_name}"
      fi
    done
  fi
  echo "${names}"
}

write_nginx_http_only_conf() {
  local target_file="$1"
  local server_names="$2"

  cat >"${target_file}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};
    charset utf-8;
    charset_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    client_max_body_size 20m;

    # Static assets from Vite build (faster than proxying through app)
    location /assets/ {
        alias ${APP_DIR}/frontend/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        access_log off;
        try_files \$uri =404;
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8000;
    }
}
EOF
}

write_nginx_cloudflare_conf() {
  local target_file="$1"
  local server_names="$2"
  local www_alias="$3"

  cat >"${target_file}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${server_names};
    charset utf-8;
    charset_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    ssl_certificate ${CLOUDFLARE_ORIGIN_CERT_PATH};
    ssl_certificate_key ${CLOUDFLARE_ORIGIN_KEY_PATH};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    $(if [[ -n "${www_alias}" ]]; then echo "if (\$host = ${www_alias}) { return 301 https://${DOMAIN}\$request_uri; }"; fi)

    client_max_body_size 20m;

    # Static assets from Vite build (faster than proxying through app)
    location /assets/ {
        alias ${APP_DIR}/frontend/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        access_log off;
        try_files \$uri =404;
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8000;
    }
}
EOF
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash ops/ubuntu/deploy.sh"
  exit 1
fi

if [[ ! -d "${APP_DIR}/backend" || ! -d "${APP_DIR}/frontend" ]]; then
  echo "App directory ${APP_DIR} is invalid. Expected backend/ and frontend/."
  echo "Copy repository to ${APP_DIR} first."
  exit 1
fi

echo "[1/10] Installing Ubuntu packages..."
apt-get update
apt-get install -y \
  ca-certificates \
  certbot \
  curl \
  git \
  gnupg \
  nginx \
  openssl \
  postgresql \
  postgresql-contrib \
  python3 \
  python3-certbot-nginx \
  python3-pip \
  python3-venv \
  sudo \
  redis-server

need_node_install="0"
if ! command -v node >/dev/null 2>&1; then
  need_node_install="1"
else
  node_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [[ "${node_major}" -lt 20 ]]; then
    need_node_install="1"
  fi
fi

if [[ "${need_node_install}" == "1" ]]; then
  echo "[2/10] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo "[2/10] Node.js already installed: $(node -v)"
fi

echo "[3/10] Enabling base services..."
systemctl enable --now postgresql redis-server nginx

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  echo "[4/10] Creating app user ${APP_USER}..."
  useradd --system --create-home --shell /bin/bash "${APP_USER}"
else
  echo "[4/10] App user ${APP_USER} already exists."
fi

echo "[5/10] Setting permissions..."
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

ENV_FILE="${APP_DIR}/.env"
ENV_EXAMPLE="${APP_DIR}/ops/ubuntu/.env.production.example"
ENV_FALLBACK="${APP_DIR}/.env.example"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[6/10] Creating .env from production template..."
  if [[ -f "${ENV_EXAMPLE}" ]]; then
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  elif [[ -f "${ENV_FALLBACK}" ]]; then
    cp "${ENV_FALLBACK}" "${ENV_FILE}"
    sed -i 's/^APP_ENV=.*/APP_ENV=production/' "${ENV_FILE}"
    sed -i 's/^ALLOW_INSECURE_DEFAULTS_IN_LOCAL=.*/ALLOW_INSECURE_DEFAULTS_IN_LOCAL=false/' "${ENV_FILE}"
    sed -i 's/^POSTGRES_HOST=.*/POSTGRES_HOST=localhost/' "${ENV_FILE}"
    sed -i 's#^REDIS_URL=.*#REDIS_URL=redis://127.0.0.1:6379/0#' "${ENV_FILE}"
  else
    echo "Missing ${ENV_EXAMPLE} and ${ENV_FALLBACK}."
    exit 1
  fi
  random_secret="$(openssl rand -hex 32)"
  sed -i "s#^SECRET_KEY=.*#SECRET_KEY=${random_secret}#g" "${ENV_FILE}"
  sed -i "s#^JWT_SECRET_KEY=.*#JWT_SECRET_KEY=${random_secret}#g" "${ENV_FILE}"
  sed -i "s#^FERNET_SECRET_KEY=.*#FERNET_SECRET_KEY=${random_secret}#g" "${ENV_FILE}"
  sed -i "s#^WEBHOOK_SECRET_KEY=.*#WEBHOOK_SECRET_KEY=${random_secret}#g" "${ENV_FILE}"
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo
  echo "Created ${ENV_FILE} with random security keys."
  echo "Fill all replace-with-* values in ${ENV_FILE}, then run deploy again."
  exit 0
fi

if grep -Eiq "replace-with-|platform-admin@example.com|change-me" "${ENV_FILE}"; then
  echo "Please update placeholders in ${ENV_FILE} (replace-with-*, platform-admin@example.com, change-me)."
  exit 1
fi

db_name="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '\r')"
db_user="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '\r')"
db_pass="$(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '\r')"

if [[ -z "${db_name}" || -z "${db_user}" || -z "${db_pass}" ]]; then
  echo "POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD must be set in ${ENV_FILE}."
  exit 1
fi

if [[ ! "${db_user}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "POSTGRES_USER must match ^[a-zA-Z_][a-zA-Z0-9_]*$"
  exit 1
fi

if [[ ! "${db_name}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "POSTGRES_DB must match ^[a-zA-Z_][a-zA-Z0-9_]*$"
  exit 1
fi

db_pass_sql_escaped="${db_pass//\'/\'\'}"

echo "[7/10] Configuring PostgreSQL role/database..."
role_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" | tr -d '[:space:]')"
if [[ "${role_exists}" == "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
    -c "ALTER ROLE \"${db_user}\" WITH LOGIN PASSWORD '${db_pass_sql_escaped}';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
    -c "CREATE ROLE \"${db_user}\" WITH LOGIN PASSWORD '${db_pass_sql_escaped}';"
fi

db_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | tr -d '[:space:]')"
if [[ "${db_exists}" == "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
    -c "ALTER DATABASE \"${db_name}\" OWNER TO \"${db_user}\";"
else
  sudo -u postgres createdb --owner="${db_user}" "${db_name}"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE \"${db_name}\" TO \"${db_user}\";"

echo "[8/10] Installing backend and frontend dependencies..."
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && python3 -m venv .venv"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/pip install --upgrade pip && ./.venv/bin/pip install -r requirements.txt"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/frontend' && npm ci && npm run build"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/alembic upgrade head"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/backend' && ./.venv/bin/python -m app.scripts.seed_superadmin"

echo "[9/10] Installing systemd + nginx config..."
install -m 644 "${APP_DIR}/ops/ubuntu/cryptoprocessing.service" /etc/systemd/system/cryptoprocessing.service
install -m 644 "${APP_DIR}/ops/ubuntu/cryptoprocessing-celery-worker.service" /etc/systemd/system/cryptoprocessing-celery-worker.service
install -m 644 "${APP_DIR}/ops/ubuntu/cryptoprocessing-celery-beat.service" /etc/systemd/system/cryptoprocessing-celery-beat.service
SERVER_NAMES="$(build_server_names)"
WWW_ALIAS=""
if echo " ${SERVER_NAMES} " | grep -q " www.${DOMAIN} "; then
  WWW_ALIAS="www.${DOMAIN}"
fi

NGINX_TARGET="/etc/nginx/sites-available/${DOMAIN}"
if [[ "${ENABLE_SSL}" == "1" && "${SSL_MODE}" == "cloudflare_origin" ]]; then
  if [[ ! -f "${CLOUDFLARE_ORIGIN_CERT_PATH}" || ! -f "${CLOUDFLARE_ORIGIN_KEY_PATH}" ]]; then
    echo "Cloudflare Origin cert/key not found."
    echo "Expected cert: ${CLOUDFLARE_ORIGIN_CERT_PATH}"
    echo "Expected key:  ${CLOUDFLARE_ORIGIN_KEY_PATH}"
    echo "Create Origin Certificate in Cloudflare dashboard and place files on server."
    exit 1
  fi
  write_nginx_cloudflare_conf "${NGINX_TARGET}" "${SERVER_NAMES}" "${WWW_ALIAS}"
else
  write_nginx_http_only_conf "${NGINX_TARGET}" "${SERVER_NAMES}"
fi

ln -sfn "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl daemon-reload
systemctl enable --now cryptoprocessing.service
systemctl enable --now cryptoprocessing-celery-worker.service
systemctl enable --now cryptoprocessing-celery-beat.service
systemctl reload nginx

echo "[10/10] SSL setup..."
if [[ "${ENABLE_SSL}" == "1" ]]; then
  case "${SSL_MODE}" in
    cloudflare_origin)
      echo "Using Cloudflare Origin Certificate."
      echo "Set Cloudflare SSL/TLS mode to Full (strict)."
      ;;
    letsencrypt)
      CERTBOT_DOMAINS_ARGS=(-d "${DOMAIN}")
      if [[ -n "${WWW_ALIAS}" ]]; then
        CERTBOT_DOMAINS_ARGS+=(-d "${WWW_ALIAS}")
      fi

      if [[ -z "${LETSENCRYPT_EMAIL}" ]]; then
        if [[ "${LETSENCRYPT_NO_EMAIL}" == "1" ]]; then
          if certbot --nginx "${CERTBOT_DOMAINS_ARGS[@]}" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
            echo "SSL certificate installed (without email)."
          else
            echo "Certbot failed. If Cloudflare proxy is ON, temporarily disable proxy (DNS only) for issuance."
          fi
        else
          echo "LETSENCRYPT_EMAIL is empty: skipped certbot."
          echo "If you don't have email, run deploy with LETSENCRYPT_NO_EMAIL=1."
          echo "Example:"
          echo "  sudo DOMAIN=${DOMAIN} APP_DIR=${APP_DIR} SSL_MODE=letsencrypt LETSENCRYPT_NO_EMAIL=1 bash ops/ubuntu/deploy.sh"
        fi
      else
        if certbot --nginx "${CERTBOT_DOMAINS_ARGS[@]}" --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" --redirect; then
          echo "SSL certificate installed."
        else
          echo "Certbot failed. If Cloudflare proxy is ON, temporarily disable proxy (DNS only) for issuance."
        fi
      fi
      ;;
    none)
      echo "SSL_MODE=none: SSL setup skipped."
      ;;
    *)
      echo "Unknown SSL_MODE=${SSL_MODE}. Supported: cloudflare_origin, letsencrypt, none."
      exit 1
      ;;
  esac
fi

echo
echo "Deploy completed."
echo "Health check (local): curl -fsS http://127.0.0.1:8000/api/v1/client/health"
echo "Service status: systemctl status cryptoprocessing --no-pager"
echo "Logs: journalctl -u cryptoprocessing -n 100 --no-pager"
