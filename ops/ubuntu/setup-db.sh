#!/usr/bin/env bash
# PostgreSQL-only server for split deployment.
#
# Usage:
#   sudo DB_LISTEN_IP=2.26.88.44 API_SERVER_IP=2.26.90.43 \
#        POSTGRES_PASSWORD='strong-pass' \
#        bash ops/ubuntu/setup-db.sh
#
set -euo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

DB_LISTEN_IP="${DB_LISTEN_IP:-}"
API_SERVER_IP="${API_SERVER_IP:-}"
POSTGRES_DB="${POSTGRES_DB:-cryptoprocessing}"
POSTGRES_USER="${POSTGRES_USER:-cryptoprocessing}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
PG_VERSION="${PG_VERSION:-16}"
ENABLE_UFW="${ENABLE_UFW:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=split-lib.sh
source "${SCRIPT_DIR}/split-lib.sh"

PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

main() {
  split_require_root

  if [[ -z "${DB_LISTEN_IP}" || -z "${API_SERVER_IP}" ]]; then
    echo "DB_LISTEN_IP and API_SERVER_IP are required."
    echo "Example: sudo DB_LISTEN_IP=2.26.88.44 API_SERVER_IP=2.26.90.43 bash ops/ubuntu/setup-db.sh"
    exit 1
  fi

  if [[ -z "${POSTGRES_PASSWORD}" ]]; then
    POSTGRES_PASSWORD="$(split_generate_password)"
    split_log "Generated POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"
  fi

  split_log "Installing PostgreSQL"
  apt-get update
  apt-get install -y postgresql postgresql-contrib

  split_log "Creating role and database"
  local pass_sql_escaped="${POSTGRES_PASSWORD//\'/\'\'}"
  local role_exists
  role_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'" | tr -d '[:space:]')"
  if [[ "${role_exists}" == "1" ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
      -c "ALTER ROLE \"${POSTGRES_USER}\" WITH LOGIN PASSWORD '${pass_sql_escaped}';"
  else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
      -c "CREATE ROLE \"${POSTGRES_USER}\" WITH LOGIN PASSWORD '${pass_sql_escaped}';"
  fi

  local db_exists
  db_exists="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | tr -d '[:space:]')"
  if [[ "${db_exists}" == "1" ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
      -c "ALTER DATABASE \"${POSTGRES_DB}\" OWNER TO \"${POSTGRES_USER}\";"
  else
    sudo -u postgres createdb --owner="${POSTGRES_USER}" "${POSTGRES_DB}"
  fi
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
    -c "GRANT ALL PRIVILEGES ON DATABASE \"${POSTGRES_DB}\" TO \"${POSTGRES_USER}\";"

  split_log "Configuring listen_addresses and pg_hba"
  if [[ -f "${PG_CONF}" ]]; then
    if grep -q "^listen_addresses" "${PG_CONF}"; then
      sed -i "s/^listen_addresses.*/listen_addresses = '${DB_LISTEN_IP}'/" "${PG_CONF}"
    else
      echo "listen_addresses = '${DB_LISTEN_IP}'" >>"${PG_CONF}"
    fi
  else
    echo "Warning: ${PG_CONF} not found. Set listen_addresses manually."
  fi

  local hba_line="host  ${POSTGRES_DB}  ${POSTGRES_USER}  ${API_SERVER_IP}/32  scram-sha-256"
  if [[ -f "${PG_HBA}" ]] && ! grep -qF "${hba_line}" "${PG_HBA}"; then
    echo "${hba_line}" >>"${PG_HBA}"
  fi

  systemctl enable --now postgresql
  systemctl restart postgresql

  if [[ "${ENABLE_UFW}" == "1" ]] && command -v ufw >/dev/null 2>&1; then
    split_log "Configuring UFW (SSH + 5432 from API only)"
    split_ufw_allow_ssh
    ufw allow from "${API_SERVER_IP}" to any port 5432 proto tcp
    split_ufw_enable
  fi

  cat <<EOF

========================================
Database server ready
========================================
Host:     ${DB_LISTEN_IP}
Database: ${POSTGRES_DB}
User:     ${POSTGRES_USER}
Password: ${POSTGRES_PASSWORD}
Allowed:  ${API_SERVER_IP}/32

Test from API server:
  PGPASSWORD='${POSTGRES_PASSWORD}' psql -h ${DB_LISTEN_IP} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c 'SELECT 1'

EOF
}

main "$@"
