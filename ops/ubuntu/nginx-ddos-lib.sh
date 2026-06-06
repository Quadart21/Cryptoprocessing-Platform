#!/usr/bin/env bash
# Shared nginx vhost fragments for DDoS / rate limiting.

nginx_install_ddos_conf_files() {
  local app_dir="${1:-/opt/cryptoprocessing}"
  install -m 644 "${app_dir}/ops/ubuntu/nginx/cryptoprocessing-limits.conf" \
    /etc/nginx/conf.d/cryptoprocessing-limits.conf
  install -m 644 "${app_dir}/ops/ubuntu/nginx/cryptoprocessing-real-ip.conf" \
    /etc/nginx/conf.d/cryptoprocessing-real-ip.conf
}

# Emits location blocks (server context) — rate limits + static + proxy routes.
nginx_emit_protected_locations() {
  local app_dir="$1"
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
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8000;
    }

    location /api/ {
        limit_req zone=cp_api burst=40 nodelay;
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

    location /internal/ {
        limit_req zone=cp_api burst=60 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8000;
    }

    location /uploads/ {
        limit_req zone=cp_general burst=80 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 60s;
        proxy_pass http://127.0.0.1:8000;
        add_header Cache-Control "public, max-age=3600";
        add_header Cross-Origin-Resource-Policy "cross-origin" always;
    }

    location /pay/ {
        limit_req zone=cp_pay burst=25 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 15s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8000;
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
        proxy_pass http://127.0.0.1:8000;
    }
EOF
}

nginx_build_server_names() {
  local domain="$1"
  local docs_domain="$2"
  local domain_aliases="$3"
  local admin_domain="${4:-}"
  local pay_domain="${5:-}"
  local names="${domain} ${docs_domain}"
  if [[ -n "${admin_domain}" ]]; then
    names="${names} ${admin_domain}"
  fi
  if [[ -n "${pay_domain}" ]]; then
    names="${names} ${pay_domain}"
  fi
  if [[ -n "${domain_aliases}" ]]; then
    IFS=',' read -ra aliases <<< "${domain_aliases}"
    for raw_alias in "${aliases[@]}"; do
      local alias_name
      alias_name="$(echo "${raw_alias}" | xargs)"
      if [[ -n "${alias_name}" && "${alias_name}" != "${domain}" ]]; then
        names="${names} ${alias_name}"
      fi
    done
  fi
  echo "${names}"
}

nginx_write_http_only_conf() {
  local target_file="$1"
  local server_names="$2"
  local app_dir="$3"

  cat >"${target_file}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};
    charset utf-8;
    charset_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    client_max_body_size 20m;

$(nginx_emit_protected_locations "${app_dir}")
}
EOF
}

nginx_write_cloudflare_conf() {
  local target_file="$1"
  local server_names="$2"
  local www_alias="$3"
  local app_dir="$4"
  local domain="$5"
  local cert_path="$6"
  local key_path="$7"

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

    ssl_certificate ${cert_path};
    ssl_certificate_key ${key_path};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    $(if [[ -n "${www_alias}" ]]; then echo "if (\$host = ${www_alias}) { return 301 https://${domain}\$request_uri; }"; fi)

    client_max_body_size 20m;

$(nginx_emit_protected_locations "${app_dir}")
}
EOF
}

nginx_regenerate_vhost() {
  local domain="${1:-noren.digital}"
  local app_dir="${2:-/opt/cryptoprocessing}"
  local docs_domain="${3:-docs.${domain}}"
  local domain_aliases="${4:-www.${domain}}"
  local cert_path="${5:-/etc/ssl/cloudflare/${domain}.pem}"
  local key_path="${6:-/etc/ssl/cloudflare/${domain}.key}"

  local server_names www_alias nginx_target
  local admin_domain="${ADMIN_DOMAIN:-admin.${domain}}"
  local pay_domain="${PAY_DOMAIN:-pay.${domain}}"
  server_names="$(nginx_build_server_names "${domain}" "${docs_domain}" "${domain_aliases}" "${admin_domain}" "${pay_domain}")"
  www_alias=""
  if echo " ${server_names} " | grep -q " www.${domain} "; then
    www_alias="www.${domain}"
  fi

  nginx_target="/etc/nginx/sites-available/${domain}"
  if [[ -f "${cert_path}" && -f "${key_path}" ]]; then
    nginx_write_cloudflare_conf "${nginx_target}" "${server_names}" "${www_alias}" \
      "${app_dir}" "${domain}" "${cert_path}" "${key_path}"
  else
    nginx_write_http_only_conf "${nginx_target}" "${server_names}" "${app_dir}"
  fi

  ln -sfn "/etc/nginx/sites-available/${domain}" "/etc/nginx/sites-enabled/${domain}"
  if [[ -f /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi
}

nginx_apply_ddos_protection() {
  local app_dir="${1:-/opt/cryptoprocessing}"
  local domain="${2:-noren.digital}"
  nginx_install_ddos_conf_files "${app_dir}"
  nginx_regenerate_vhost "${domain}" "${app_dir}"
  nginx -t
  systemctl reload nginx
}
