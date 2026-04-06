#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.error
import urllib.request


API_BASE_URL = os.getenv("API_BASE_URL", "https://noren.digital/api/v1/client")
API_KEY = os.getenv("API_KEY", "pk_live_5WbGRSMjzRDWo4JPrHGMRm4L")
API_SECRET = os.getenv("API_SECRET", "sk_live_09pn30MJRtpbe7taPY10NlPZ1RWdQkbPVZ19jmnsLK0")
PROJECT_ID = os.getenv("PROJECT_ID", "f642df01-6aed-4d53-b032-a29f9b3c4b84")
AMOUNT_FIAT = os.getenv("AMOUNT_FIAT", "100")
FIAT_CURRENCY = os.getenv("FIAT_CURRENCY", "USD")
CRYPTO_CURRENCY = os.getenv("CRYPTO_CURRENCY", "USDT")
NETWORK = os.getenv("NETWORK", "TRC20")
ORDER_PREFIX = os.getenv("ORDER_PREFIX", "merchant_full_test")
LIMIT = os.getenv("LIMIT", "20")
USER_AGENT = os.getenv(
    "USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
)


def print_section(title: str) -> None:
    print("\n" + "=" * 64)
    print(title)
    print("=" * 64)


def pretty_json(payload: str) -> None:
    try:
        print(json.dumps(json.loads(payload), ensure_ascii=False, indent=2))
    except json.JSONDecodeError:
        print(payload)


def api_request(method: str, path: str, body: dict | None = None, public: bool = False) -> tuple[int, str]:
    url = f"{API_BASE_URL}{path}"
    data = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }

    if not public:
        headers["X-API-Key"] = API_KEY
        headers["X-API-Secret"] = API_SECRET

    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url=url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request) as response:
            return response.getcode(), response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def assert_2xx(code: int, context: str, body: str) -> None:
    if code < 200 or code >= 300:
        print(f"[FAIL] {context} -> HTTP {code}")
        print(body)
        sys.exit(1)
    print(f"[OK] {context} -> HTTP {code}")


def json_field(payload: str, field: str) -> str:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return ""
    value = data
    for part in field.split("."):
        if not isinstance(value, dict):
            return ""
        value = value.get(part)
        if value is None:
            return ""
    return value if isinstance(value, str) else (json.dumps(value, ensure_ascii=False) if value is not None else "")


def first_list_id(payload: str) -> str:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return ""
    items = data if isinstance(data, list) else data.get("items", [])
    for item in items:
        if isinstance(item, dict) and item.get("id"):
            return str(item["id"])
    return ""


def main() -> None:
    order_id = f"{ORDER_PREFIX}_{time.strftime('%Y%m%d_%H%M%S')}"

    print_section("1) Public health")
    code, body = api_request("GET", "/health", public=True)
    assert_2xx(code, "GET /health", body)
    pretty_json(body)

    print_section("2) Rates")
    code, body = api_request("GET", "/rates")
    assert_2xx(code, "GET /rates", body)
    pretty_json(body)

    print_section("3) Balance")
    code, body = api_request("GET", "/balance")
    assert_2xx(code, "GET /balance", body)
    pretty_json(body)

    print_section("4) Create invoice")
    code, body = api_request(
        "POST",
        "/invoices",
        body={
            "project_id": PROJECT_ID,
            "merchant_order_id": order_id,
            "amount_fiat": int(AMOUNT_FIAT),
            "fiat_currency": FIAT_CURRENCY,
            "crypto_currency": CRYPTO_CURRENCY,
            "network": NETWORK,
            "metadata": {
                "source": "merchant-api-full-test",
                "order_id": order_id,
            },
        },
    )
    assert_2xx(code, "POST /invoices", body)
    pretty_json(body)
    invoice_id = json_field(body, "id")
    if not invoice_id:
        print("[FAIL] invoice id is missing")
        sys.exit(1)
    print(f"invoice_id={invoice_id}")

    print_section("5) Get invoice by id")
    code, body = api_request("GET", f"/invoices/{invoice_id}")
    assert_2xx(code, "GET /invoices/{id}", body)
    pretty_json(body)

    print_section("6) List invoices")
    code, body = api_request("GET", f"/invoices?limit={LIMIT}&offset=0")
    assert_2xx(code, "GET /invoices", body)
    pretty_json(body)

    print_section("7) Sync invoice")
    code, body = api_request("POST", f"/invoices/{invoice_id}/sync")
    assert_2xx(code, "POST /invoices/{id}/sync", body)
    pretty_json(body)

    print_section("8) List transactions")
    code, body = api_request("GET", f"/transactions?limit={LIMIT}&offset=0")
    assert_2xx(code, "GET /transactions", body)
    pretty_json(body)
    transaction_id = first_list_id(body)

    print_section("9) Get transaction by id")
    if transaction_id:
        code, body = api_request("GET", f"/transactions/{transaction_id}")
        assert_2xx(code, "GET /transactions/{id}", body)
        pretty_json(body)
    else:
        print("[SKIP] No transaction id available yet.")

    print("\nMerchant API full test finished successfully.")
    print(f"merchant_order_id={order_id}")
    print(f"invoice_id={invoice_id}")
    if transaction_id:
        print(f"transaction_id={transaction_id}")


if __name__ == "__main__":
    main()
