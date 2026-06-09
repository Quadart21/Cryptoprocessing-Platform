#!/usr/bin/env bash
# Nginx vhosts for split deployment (site + api upstream).

# shellcheck source=nginx-ddos-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nginx-ddos-lib.sh"

nginx_emit_site_upstream_locations() {
  local app_dir="$1"
  local api_upstream="$2"
  local api_host_header="${3:-api.example.com}"
  cat <<EOF
    limit_conn cp_conn 50;
    limit_conn_status 503;
    limit_req_status 429;

    location /assets/ {
        alias ${app_dir}/frontend/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        access_log off;
        try_files \$uri =404;
    }

    location ~ ^/api/v1/client/auth/(login|register|set-password) {
        limit_req zone=cp_auth burst=15 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host ${api_host_header};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://${api_upstream};
    }

    location /api/ {
        limit_req zone=cp_api burst=40 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host ${api_host_header};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://${api_upstream};
    }

    location /internal/ {
        limit_req zone=cp_api burst=60 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host ${api_host_header};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://${api_upstream};
    }

    location /uploads/ {
        limit_req zone=cp_general burst=80 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host ${api_host_header};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 60s;
        proxy_pass http://${api_upstream};
        add_header Cache-Control "public, max-age=300, must-revalidate";
        add_header Cross-Origin-Resource-Policy "cross-origin" always;
    }

    location /docs {
        limit_req zone=cp_general burst=80 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host ${api_host_header};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass http://${api_upstream};
    }

    location = /openapi.json {
        limit_req zone=cp_general burst=80 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host ${api_host_header};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass http://${api_upstream};
    }

    location / {
        limit_req zone=cp_general burst=80 nodelay;
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
        proxy_pass http://${api_upstream};
    }
EOF
}

nginx_write_site_vhost() {
  local target_file="$1"
  local server_names="$2"
  local www_alias="$3"
  local domain="$4"
  local app_dir="$5"
  local api_upstream="$6"
  local api_host_header="$7"
  local cert_path="$8"
  local key_path="$9"
  local ssl_enabled="${10:-1}"

  if [[ "${ssl_enabled}" == "1" && -f "${cert_path}" && -f "${key_path}" ]]; then
    cat >"${target_file}" <<EOF
upstream cryptoprocessing_api_upstream {
    server ${api_upstream};
    keepalive 32;
}

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

    ssl_certificate ${cert_path};
    ssl_certificate_key ${key_path};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    $(if [[ -n "${www_alias}" ]]; then echo "if (\$host = ${www_alias}) { return 301 https://${domain}\$request_uri; }"; fi)

    client_max_body_size 20m;
    root ${app_dir}/frontend/dist;

$(nginx_emit_site_upstream_locations "${app_dir}" "cryptoprocessing_api_upstream" "${api_host_header}")
}
EOF
  else
    cat >"${target_file}" <<EOF
upstream cryptoprocessing_api_upstream {
    server ${api_upstream};
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};
    charset utf-8;
    charset_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    client_max_body_size 20m;
    root ${app_dir}/frontend/dist;

$(nginx_emit_site_upstream_locations "${app_dir}" "cryptoprocessing_api_upstream" "${api_host_header}")
}
EOF
  fi
}

nginx_emit_api_locations() {
  cat <<'EOF'
    limit_conn cp_conn 50;
    limit_conn_status 503;
    limit_req_status 429;

    location ~ ^/api/v1/client/auth/(login|register|set-password) {
        limit_req zone=cp_auth burst=15 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8000;
    }

    location / {
        limit_req zone=cp_api burst=40 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8000;
    }
EOF
}

nginx_write_api_vhost() {
  local target_file="$1"
  local api_server_name="$2"
  local cert_path="$3"
  local key_path="$4"
  local ssl_enabled="${5:-1}"

  if [[ "${ssl_enabled}" == "1" && -f "${cert_path}" && -f "${key_path}" ]]; then
    cat >"${target_file}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${api_server_name};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${api_server_name};
    charset utf-8;
    charset_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    ssl_certificate ${cert_path};
    ssl_certificate_key ${key_path};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    client_max_body_size 20m;

$(nginx_emit_api_locations)
}
EOF
  else
    cat >"${target_file}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${api_server_name};
    charset utf-8;
    charset_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    client_max_body_size 20m;

$(nginx_emit_api_locations)
}
EOF
  fi
}

nginx_install_site_vhost() {
  local domain="${1:-noren.digital}"
  local app_dir="${2:-/opt/cryptoprocessing}"
  local api_upstream="${3:-127.0.0.1:8000}"
  local domain_aliases="${4:-www.${domain}}"
  local cert_path="${5:-/etc/ssl/cloudflare/${domain}.pem}"
  local key_path="${6:-/etc/ssl/cloudflare/${domain}.key}"

  local docs_domain="${DOCS_DOMAIN:-docs.${domain}}"
  local admin_domain="${ADMIN_DOMAIN:-admin.${domain}}"
  local pay_domain="${PAY_DOMAIN:-pay.${domain}}"
  local app_domain="${APP_DOMAIN:-app.${domain}}"
  local api_domain="${API_DOMAIN:-api.${domain}}"

  local server_names
  server_names="$(nginx_build_server_names "${domain}" "${docs_domain}" "${domain_aliases}" "${admin_domain}" "${pay_domain}")"
  server_names="${server_names} ${app_domain}"

  local www_alias=""
  if echo " ${server_names} " | grep -q " www.${domain} "; then
    www_alias="www.${domain}"
  fi

  local nginx_target="/etc/nginx/sites-available/${domain}"
  nginx_install_ddos_conf_files "${app_dir}"
  nginx_write_site_vhost "${nginx_target}" "${server_names}" "${www_alias}" "${domain}" \
    "${app_dir}" "${api_upstream}" "${api_domain}" "${cert_path}" "${key_path}" "${ENABLE_SSL:-1}"

  ln -sfn "${nginx_target}" "/etc/nginx/sites-enabled/${domain}"
  rm -f /etc/nginx/sites-enabled/default
}

nginx_install_api_vhost() {
  local domain="${1:-noren.digital}"
  local cert_path="${2:-/etc/ssl/cloudflare/${domain}.pem}"
  local key_path="${3:-/etc/ssl/cloudflare/${domain}.key}"
  local api_domain="${API_DOMAIN:-api.${domain}}"
  local app_dir="${4:-/opt/cryptoprocessing}"

  local nginx_target="/etc/nginx/sites-available/${api_domain}"
  nginx_install_ddos_conf_files "${app_dir}"
  nginx_write_api_vhost "${nginx_target}" "${api_domain}" "${cert_path}" "${key_path}" "${ENABLE_SSL:-1}"
  ln -sfn "${nginx_target}" "/etc/nginx/sites-enabled/${api_domain}"
  rm -f /etc/nginx/sites-enabled/default
}
