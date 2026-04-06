#!/usr/bin/env python3
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request


API_BASE_URL = os.getenv("API_BASE_URL", "https://noren.digital/api/v1/client")
API_KEY = os.getenv("API_KEY", "pk_live_5WbGRSMjzRDWo4JPrHGMRm4L")
API_SECRET = os.getenv("API_SECRET", "sk_live_09pn30MJRtpbe7taPY10NlPZ1RWdQkbPVZ19jmnsLK0")
PROJECT_ID = os.getenv("PROJECT_ID", "f642df01-6aed-4d53-b032-a29f9b3c4b84")
FIAT_CURRENCY = os.getenv("FIAT_CURRENCY", "USD")
ORDER_PREFIX = os.getenv("ORDER_PREFIX", "merchant_random_test")
INVOICE_COUNT = os.getenv("INVOICE_COUNT", "5")
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


def get_available_networks(body: str) -> list[dict]:
    try:
        data = json.loads(body)
        networks = []
        for item in data.get("items", []):
            currency = item.get("currency", "")
            for network in item.get("networks", []):
                if network.get("availability") and network.get("acquiring"):
                    min_deposit = network.get("min_deposit")
                    if min_deposit:
                        try:
                            min_amount = float(min_deposit)
                            networks.append({
                                "currency": currency,
                                "network": network.get("network", ""),
                                "min_amount": min_amount,
                            })
                        except (ValueError, TypeError):
                            pass
        return networks
    except json.JSONDecodeError:
        return []


def main() -> None:
    invoice_count = int(INVOICE_COUNT)

    print_section("1) Public health")
    code, body = api_request("GET", "/health", public=True)
    assert_2xx(code, "GET /health", body)
    print(body)

    print_section("2) Get available networks from rates")
    code, body = api_request("GET", "/rates")
    assert_2xx(code, "GET /rates", body)
    networks = get_available_networks(body)
    if not networks:
        print("[FAIL] No available networks found")
        sys.exit(1)
    print(f"Found {len(networks)} available networks")
    for i, n in enumerate(networks[:5]):
        print(f"  {i+1}. {n['currency']}/{n['network']} (min: {n['min_amount']})")

    print_section("3) Create random invoices")
    created_invoices = []
    for i in range(invoice_count):
        network_data = random.choice(networks)
        crypto_currency = network_data["currency"]
        network = network_data["network"]
        min_amount = network_data["min_amount"]
        
        order_id = f"{ORDER_PREFIX}_{time.strftime('%Y%m%d_%H%M%S')}_{i+1}"
        
        print(f"\n--- Invoice {i+1}/{invoice_count} ---")
        print(f"  {crypto_currency}/{network}, min amount: {min_amount}")
        
        code, body = api_request(
            "POST",
            "/invoices",
            body={
                "project_id": PROJECT_ID,
                "merchant_order_id": order_id,
                "amount_fiat": min_amount,
                "fiat_currency": FIAT_CURRENCY,
                "crypto_currency": crypto_currency,
                "network": network,
                "metadata": {
                    "source": "merchant-random-test",
                    "order_id": order_id,
                },
            },
        )
        
        if code >= 200 and code < 300:
            print(f"[OK] Created invoice: {order_id}")
            pretty_json(body)
            created_invoices.append(order_id)
        else:
            print(f"[FAIL] HTTP {code}: {body}")
            time.sleep(1)

    print_section("4) Summary")
    print(f"Total invoices created: {len(created_invoices)}")
    for inv in created_invoices:
        print(f"  - {inv}")

    print("\nRandom test finished.")


if __name__ == "__main__":
    main()