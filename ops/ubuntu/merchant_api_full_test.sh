#!/usr/bin/env bash
set -euo pipefail

# Full merchant API test using X-API-Key / X-API-Secret.
#
# Usage:
#   API_BASE_URL="https://noren.digital/api/v1/client" \
#   API_KEY="pk_live_xxx" \
#   API_SECRET="sk_live_xxx" \
#   PROJECT_ID="project_uuid" \
#   bash ops/ubuntu/merchant_api_full_test.sh
#
# Optional:
#   AMOUNT_FIAT=100
#   FIAT_CURRENCY=USD
#   CRYPTO_CURRENCY=USDT
#   NETWORK=TRC20
#   ORDER_PREFIX=merchant_full_test
#   LIMIT=20

API_BASE_URL="${API_BASE_URL:-https://noren.digital/api/v1/client}"
API_KEY="${API_KEY:-pk_live_5WbGRSMjzRDWo4JPrHGMRm4L}"
API_SECRET="${API_SECRET:-sk_live_09pn30MJRtpbe7taPY10NlPZ1RWdQkbPVZ19jmnsLK0}"
PROJECT_ID="${PROJECT_ID:-f642df01-6aed-4d53-b032-a29f9b3c4b84}"
AMOUNT_FIAT="${AMOUNT_FIAT:-100}"
FIAT_CURRENCY="${FIAT_CURRENCY:-USD}"
CRYPTO_CURRENCY="${CRYPTO_CURRENCY:-USDT}"
NETWORK="${NETWORK:-TRC20}"
ORDER_PREFIX="${ORDER_PREFIX:-merchant_full_test}"
LIMIT="${LIMIT:-20}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required"
  exit 1
fi

ORDER_ID="${ORDER_PREFIX}_$(date +%Y%m%d_%H%M%S)"
INVOICE_ID=""
TRANSACTION_ID=""

print_section() {
  echo
  echo "================================================================"
  echo "$1"
  echo "================================================================"
}

pretty_json() {
  local payload="$1"
  echo "${payload}" | python3 -m json.tool 2>/dev/null || echo "${payload}"
}

json_field() {
  local payload="$1"
  local path="$2"
  python3 - "$path" <<'PY' <<<"${payload}"
import json
import sys

path = sys.argv[1].split(".")
raw = sys.stdin.read().strip()
if not raw:
    print("")
    raise SystemExit(0)

try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("")
    raise SystemExit(0)

value = data
for part in path:
    if isinstance(value, dict):
        value = value.get(part)
    else:
        value = None
    if value is None:
        break

if value is None:
    print("")
elif isinstance(value, (dict, list)):
    print(json.dumps(value, ensure_ascii=False))
else:
    print(str(value))
PY
}

json_find_first() {
  local payload="$1"
  local field="$2"
  python3 - "$field" <<'PY' <<<"${payload}"
import json
import sys

field = sys.argv[1]
raw = sys.stdin.read().strip()
if not raw:
    print("")
    raise SystemExit(0)

try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("")
    raise SystemExit(0)

items = data if isinstance(data, list) else data.get("items", [])
for item in items:
    if isinstance(item, dict) and item.get(field) is not None:
        print(str(item[field]))
        raise SystemExit(0)
print("")
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
    printf '%s\n%s' "${code}" "${response}"
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
  printf '%s\n%s' "${code}" "${response}"
}

assert_http_2xx() {
  local code="$1"
  local context="$2"
  local body="$3"
  if [[ "${code}" != 2* ]]; then
    echo "[FAIL] ${context} -> HTTP ${code}"
    echo "${body}"
    exit 1
  fi
  echo "[OK] ${context} -> HTTP ${code}"
}

print_section "1) Public health"
health_code="$(curl -sS -o /tmp/merchant_health.out -w "%{http_code}" "${API_BASE_URL}/health")"
health_body="$(cat /tmp/merchant_health.out)"
rm -f /tmp/merchant_health.out
assert_http_2xx "${health_code}" "GET /health" "${health_body}"
pretty_json "${health_body}"

print_section "2) Rates"
rates_result="$(call_api GET "/rates")"
rates_code="$(echo "${rates_result}" | head -n1)"
rates_body="$(echo "${rates_result}" | tail -n +2)"
assert_http_2xx "${rates_code}" "GET /rates" "${rates_body}"
pretty_json "${rates_body}"

print_section "3) Balance"
balance_result="$(call_api GET "/balance")"
balance_code="$(echo "${balance_result}" | head -n1)"
balance_body="$(echo "${balance_result}" | tail -n +2)"
assert_http_2xx "${balance_code}" "GET /balance" "${balance_body}"
pretty_json "${balance_body}"

print_section "4) Create invoice"
create_payload="$(cat <<JSON
{
  "project_id": "${PROJECT_ID}",
  "merchant_order_id": "${ORDER_ID}",
  "amount_fiat": ${AMOUNT_FIAT},
  "fiat_currency": "${FIAT_CURRENCY}",
  "crypto_currency": "${CRYPTO_CURRENCY}",
  "network": "${NETWORK}",
  "metadata": {
    "source": "merchant-api-full-test",
    "order_id": "${ORDER_ID}"
  }
}
JSON
)"
create_result="$(call_api POST "/invoices" "${create_payload}")"
create_code="$(echo "${create_result}" | head -n1)"
create_body="$(echo "${create_result}" | tail -n +2)"
assert_http_2xx "${create_code}" "POST /invoices" "${create_body}"
pretty_json "${create_body}"

INVOICE_ID="$(json_field "${create_body}" "id")"
if [[ -z "${INVOICE_ID}" ]]; then
  echo "[FAIL] invoice id is missing"
  exit 1
fi
echo "invoice_id=${INVOICE_ID}"

print_section "5) Get invoice by id"
invoice_result="$(call_api GET "/invoices/${INVOICE_ID}")"
invoice_code="$(echo "${invoice_result}" | head -n1)"
invoice_body="$(echo "${invoice_result}" | tail -n +2)"
assert_http_2xx "${invoice_code}" "GET /invoices/{id}" "${invoice_body}"
pretty_json "${invoice_body}"

print_section "6) List invoices"
list_result="$(call_api GET "/invoices?limit=${LIMIT}&offset=0")"
list_code="$(echo "${list_result}" | head -n1)"
list_body="$(echo "${list_result}" | tail -n +2)"
assert_http_2xx "${list_code}" "GET /invoices" "${list_body}"
pretty_json "${list_body}"

print_section "7) Sync invoice"
sync_result="$(call_api POST "/invoices/${INVOICE_ID}/sync")"
sync_code="$(echo "${sync_result}" | head -n1)"
sync_body="$(echo "${sync_result}" | tail -n +2)"
assert_http_2xx "${sync_code}" "POST /invoices/{id}/sync" "${sync_body}"
pretty_json "${sync_body}"

print_section "8) List transactions"
tx_result="$(call_api GET "/transactions?limit=${LIMIT}&offset=0")"
tx_code="$(echo "${tx_result}" | head -n1)"
tx_body="$(echo "${tx_result}" | tail -n +2)"
assert_http_2xx "${tx_code}" "GET /transactions" "${tx_body}"
pretty_json "${tx_body}"

TRANSACTION_ID="$(json_find_first "${tx_body}" "id")"
if [[ -n "${TRANSACTION_ID}" ]]; then
  print_section "9) Get transaction by id"
  tx_detail_result="$(call_api GET "/transactions/${TRANSACTION_ID}")"
  tx_detail_code="$(echo "${tx_detail_result}" | head -n1)"
  tx_detail_body="$(echo "${tx_detail_result}" | tail -n +2)"
  assert_http_2xx "${tx_detail_code}" "GET /transactions/{id}" "${tx_detail_body}"
  pretty_json "${tx_detail_body}"
else
  print_section "9) Get transaction by id"
  echo "[SKIP] No transaction id available yet."
fi

echo
echo "Merchant API full test finished successfully."
echo "merchant_order_id=${ORDER_ID}"
echo "invoice_id=${INVOICE_ID}"
if [[ -n "${TRANSACTION_ID}" ]]; then
  echo "transaction_id=${TRANSACTION_ID}"
fi
