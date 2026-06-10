#!/usr/bin/env python3
"""Создать инвойс USDT TRC20 и вывести платёжную страницу."""

from __future__ import annotations

import json
import os
import sys
import uuid
import webbrowser
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ENV_PATH = Path(__file__).resolve().parent / ".env"
AMOUNT = os.environ.get("NOREN_INVOICE_AMOUNT", "15")
CRYPTO = "USDT"
NETWORK = "TRC20"


def load_env() -> None:
    if not ENV_PATH.is_file():
        return
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def main() -> int:
    load_env()
    base = os.environ.get("NOREN_API_BASE", "").rstrip("/")
    public = os.environ.get("NOREN_PUBLIC_KEY", "")
    secret = os.environ.get("NOREN_SECRET_KEY", "")
    project_id = os.environ.get("NOREN_PROJECT_ID", "")

    if not all([base, public, secret, project_id]):
        print("Заполните .env: NOREN_API_BASE, ключи и NOREN_PROJECT_ID")
        return 2

    body = {
        "project_id": project_id,
        "merchant_order_id": f"usdt-{uuid.uuid4().hex[:12]}",
        "amount_fiat": AMOUNT,
        "fiat_currency": "USD",
        "crypto_currency": CRYPTO,
        "network": NETWORK,
        "metadata": {"source": "examples/create_usdt_invoice.py"},
    }
    req = Request(
        f"{base}/api/v1/client/invoices",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "X-API-Key": public,
            "X-API-Secret": secret,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
    )
    try:
        with urlopen(req, timeout=30) as resp:
            invoice = json.loads(resp.read())
    except HTTPError as exc:
        print(exc.read().decode("utf-8", errors="replace"))
        return 1

    print("=== Инвойс USDT создан ===")
    print(f"Сумма:        {invoice.get('amount_crypto')} {invoice.get('crypto_currency')} ({invoice.get('network')})")
    print(f"Статус:       {invoice.get('status')}")
    print(f"ID:           {invoice.get('id')}")
    print(f"Order:        {invoice.get('merchant_order_id')}")
    print(f"Адрес:        {invoice.get('payment_address')}")
    print(f"Истекает:     {invoice.get('expires_at')}")
    page = invoice.get("payment_page_url")
    if page:
        print(f"Платёжная:    {page}")
        if os.environ.get("NOREN_OPEN_BROWSER", "1") != "0":
            webbrowser.open(str(page), new=2)
    if invoice.get("qr_url"):
        print(f"QR:           {invoice.get('qr_url')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
