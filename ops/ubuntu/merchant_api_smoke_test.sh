#!/usr/bin/env bash
set -euo pipefail

# Merchant API smoke test for NorenCash client endpoints.
# Requires: curl, python3
#
# Usage example:
#   API_BASE_URL="https://noren.digital/api/v1/client" \
#   API_KEY="pk_live_xxx" \
#   API_SECRET="sk_live_xxx" \
#   PROJECT_ID="project_uuid" \
#   bash ops/ubuntu/merchant_api_smoke_test.sh
#
# Optional:
#   AMOUNT_FIAT=10
#   FIAT_CURRENCY=USD
#   CRYPTO_CURRENCY=USDT
#   NETWORK=TRC20

API_BASE_URL="${API_BASE_URL:-https://noren.digital/api/v1/client}"
API_KEY="${API_KEY:-}"
API_SECRET="${API_SECRET:-}"
PROJECT_ID="${PROJECT_ID:-}"
AMOUNT_FIAT="${AMOUNT_FIAT:-10}"
FIAT_CURRENCY="${FIAT_CURRENCY:-USD}"
CRYPTO_CURRENCY="${CRYPTO_CURRENCY:-USDT}"
NETWORK="${NETWORK:-TRC20}"

if [[ -z "${API_KEY}" || -z "${API_SECRET}" || -z "${PROJECT_ID}" ]]; then
  echo "Missing required variables."
  echo "Required: API_KEY, API_SECRET, PROJECT_ID"
  echo "Optional: API_BASE_URL, AMOUNT_FIAT, FIAT_CURRENCY, CRYPTO_CURRENCY, NETWORK"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required."
  exit 1
fi

ORDER_ID="smoke_$(date +%Y%m%d_%H%M%S)"

print_section() {
  local title="$1"
  echo
  echo "============================================================"
  echo "${title}"
  echo "============================================================"
}

parse_json_field() {
  local payload="$1"
  local field="$2"
  python3 - "$field" <<'PY' <<<"${payload}"
import json
import sys

field = sys.argv[1]
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("")
    raise SystemExit(0)

value = data.get(field, "")
if value is None:
    value = ""
print(str(value))
PY
}

call_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  local url="${API_BASE_URL}${path}"
  local tmp_file
  tmp_file="$(mktemp)"

  if [[ -n "${body}" ]]; then
    local code
    code="$(curl -sS -X "${method}" \
      -H "X-API-Key: ${API_KEY}" \
      -H "X-API-Secret: ${API_SECRET}" \
      -H "Content-Type: application/json" \
      -o "${tmp_file}" \
      -w "%{http_code}" \
      --data "${body}" \
      "${url}")"
    local response
    response="$(cat "${tmp_file}")"
    rm -f "${tmp_file}"
    echo "${code}"$'\n'"${response}"
    return 0
  fi

  local code
  code="$(curl -sS -X "${method}" \
    -H "X-API-Key: ${API_KEY}" \
    -H "X-API-Secret: ${API_SECRET}" \
    -o "${tmp_file}" \
    -w "%{http_code}" \
    "${url}")"
  local response
  response="$(cat "${tmp_file}")"
  rm -f "${tmp_file}"
  echo "${code}"$'\n'"${response}"
}

assert_http_2xx() {
  local code="$1"
  local context="$2"
  local body="$3"
  if [[ "${code}" != 2* ]]; then
    echo "[FAIL] ${context} -> HTTP ${code}"
    echo "Response:"
    echo "${body}"
    exit 1
  fi
  echo "[OK] ${context} -> HTTP ${code}"
}

print_section "1) Health (public)"
health_code="$(curl -sS -o /tmp/merchant_health.out -w "%{http_code}" "${API_BASE_URL}/health")"
health_body="$(cat /tmp/merchant_health.out)"
rm -f /tmp/merchant_health.out
assert_http_2xx "${health_code}" "GET /health" "${health_body}"
echo "${health_body}"

print_section "2) Rates"
rates_result="$(call_api GET "/rates")"
rates_code="$(echo "${rates_result}" | head -n1)"
rates_body="$(echo "${rates_result}" | tail -n +2)"
assert_http_2xx "${rates_code}" "GET /rates" "${rates_body}"
echo "${rates_body}" | python3 -m json.tool 2>/dev/null || echo "${rates_body}"

print_section "3) Create invoice"
create_payload="$(cat <<JSON
{
  "project_id": "${PROJECT_ID}",
  "merchant_order_id": "${ORDER_ID}",
  "amount_fiat": ${AMOUNT_FIAT},
  "fiat_currency": "${FIAT_CURRENCY}",
  "crypto_currency": "${CRYPTO_CURRENCY}",
  "network": "${NETWORK}"
}
JSON
)"

create_result="$(call_api POST "/invoices" "${create_payload}")"
create_code="$(echo "${create_result}" | head -n1)"
create_body="$(echo "${create_result}" | tail -n +2)"
assert_http_2xx "${create_code}" "POST /invoices" "${create_body}"
echo "${create_body}" | python3 -m json.tool 2>/dev/null || echo "${create_body}"

invoice_id="$(parse_json_field "${create_body}" "id")"
if [[ -z "${invoice_id}" ]]; then
  echo "[FAIL] invoice id is missing in create response."
  exit 1
fi
echo "Created invoice_id: ${invoice_id}"

print_section "4) Get invoice by id"
invoice_result="$(call_api GET "/invoices/${invoice_id}")"
invoice_code="$(echo "${invoice_result}" | head -n1)"
invoice_body="$(echo "${invoice_result}" | tail -n +2)"
assert_http_2xx "${invoice_code}" "GET /invoices/{id}" "${invoice_body}"
echo "${invoice_body}" | python3 -m json.tool 2>/dev/null || echo "${invoice_body}"

print_section "5) List invoices"
list_result="$(call_api GET "/invoices")"
list_code="$(echo "${list_result}" | head -n1)"
list_body="$(echo "${list_result}" | tail -n +2)"
assert_http_2xx "${list_code}" "GET /invoices" "${list_body}"
echo "${list_body}" | python3 -m json.tool 2>/dev/null || echo "${list_body}"

print_section "6) Sync created invoice"
sync_result="$(call_api POST "/invoices/${invoice_id}/sync")"
sync_code="$(echo "${sync_result}" | head -n1)"
sync_body="$(echo "${sync_result}" | tail -n +2)"
assert_http_2xx "${sync_code}" "POST /invoices/{id}/sync" "${sync_body}"
echo "${sync_body}" | python3 -m json.tool 2>/dev/null || echo "${sync_body}"

print_section "7) Balance"
balance_result="$(call_api GET "/balance")"
balance_code="$(echo "${balance_result}" | head -n1)"
balance_body="$(echo "${balance_result}" | tail -n +2)"
assert_http_2xx "${balance_code}" "GET /balance" "${balance_body}"
echo "${balance_body}" | python3 -m json.tool 2>/dev/null || echo "${balance_body}"

print_section "8) Transactions"
tx_result="$(call_api GET "/transactions")"
tx_code="$(echo "${tx_result}" | head -n1)"
tx_body="$(echo "${tx_result}" | tail -n +2)"
assert_http_2xx "${tx_code}" "GET /transactions" "${tx_body}"
echo "${tx_body}" | python3 -m json.tool 2>/dev/null || echo "${tx_body}"

echo
echo "Smoke test finished successfully."
echo "merchant_order_id used: ${ORDER_ID}"
echo "invoice_id: ${invoice_id}"
