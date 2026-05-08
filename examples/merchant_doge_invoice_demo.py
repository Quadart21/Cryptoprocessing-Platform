#!/usr/bin/env python3
"""
Тестовый вызов Merchant API:
  1) GET /rates — активные для клиента токены и сети
  2) POST /invoices — инвойс на 5 USD в DOGE (первая доступная для приёма сеть)

Переменные читаются из окружения и из файла `.env` в той же папке, что и скрипт
(значения уже заданные в окружении не перезаписываются).

Обязательные ключи:
  NOREN_API_BASE      — например https://your-host.com (без хвостового слэша)
  NOREN_PUBLIC_KEY    — pk_live_...
  NOREN_SECRET_KEY    — sk_live_...
  NOREN_PROJECT_ID    — UUID проекта (тот же, к которому привязана пара ключей)

Опционально (если Cloudflare режет urllib по умолчанию):
  NOREN_USER_AGENT     — свой User-Agent, иначе подставится типичный Chrome/Windows

Стандартная библиотека только (без pip install requests).
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

# urllib по умолчанию шлёт User-Agent вида Python-urllib/… — многие WAF (Cloudflare) блокируют это как бота.
_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def _http_headers(extra: dict[str, str]) -> dict[str, str]:
    merged: dict[str, str] = {
        "User-Agent": os.environ.get("NOREN_USER_AGENT", _DEFAULT_UA).strip() or _DEFAULT_UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": os.environ.get(
            "NOREN_ACCEPT_LANGUAGE",
            "en-US,en;q=0.9,ru;q=0.8",
        ),
    }
    merged.update(extra)
    return merged


def load_env_file(env_path: Path) -> None:
    """Минимальный разбор .env: KEY=VALUE, без multiline и без export."""
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def _json_request(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    body: dict[str, Any] | None = None,
) -> Any:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = Request(url, data=data, method=method, headers=headers)
    try:
        with urlopen(req, timeout=60) as resp:
            payload = resp.read().decode("utf-8") or "{}"
            return json.loads(payload)
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e


def fetch_rates(base: str, public: str, secret: str) -> dict[str, Any]:
    url = f"{base}/api/v1/client/rates"
    return _json_request(
        "GET",
        url,
        headers=_http_headers(
            {
                "X-API-Key": public,
                "X-API-Secret": secret,
            },
        ),
    )


def create_invoice(
    base: str,
    public: str,
    secret: str,
    *,
    project_id: str,
    merchant_order_id: str,
    amount_usd: str,
    crypto_currency: str,
    network: str,
) -> dict[str, Any]:
    url = f"{base}/api/v1/client/invoices"
    body = {
        "project_id": project_id,
        "merchant_order_id": merchant_order_id,
        "amount_fiat": amount_usd,
        "fiat_currency": "USD",
        "crypto_currency": crypto_currency,
        "network": network,
        "metadata": {"source": "examples/merchant_doge_invoice_demo.py"},
    }
    return _json_request(
        "POST",
        url,
        headers=_http_headers(
            {
                "X-API-Key": public,
                "X-API-Secret": secret,
                "Content-Type": "application/json",
            },
        ),
        body=body,
    )


def print_active_assets(rates: dict[str, Any]) -> None:
    items = rates.get("items") or []
    print("\n=== Активы и сети (available для клиента / acquiring) ===\n")
    for item in items:
        currency = item.get("currency")
        nets = item.get("networks") or []
        for n in nets:
            if not n.get("client_available"):
                continue
            if not n.get("acquiring"):
                continue
            line = (
                f"  {currency} / network={n.get('network')}  "
                f"ticker={n.get('ticker')}  memo_required={n.get('memo_required')}"
            )
            print(line)
    print()


def pick_doge_network(rates: dict[str, Any]) -> tuple[str, str]:
    """Возвращает (crypto_currency, network) верхним регистром."""
    items = rates.get("items") or []
    for item in items:
        currency = str(item.get("currency") or "").upper()
        if currency != "DOGE":
            continue
        for n in item.get("networks") or []:
            if not (n.get("client_available") and n.get("acquiring")):
                continue
            network = str(n.get("network") or "").upper()
            if network:
                return currency, network
    raise LookupError(
        "В ответе /rates нет DOGE с сетью, доступной для приёма (client_available+acquiring)."
    )


def main() -> int:
    load_env_file(Path(__file__).resolve().parent / ".env")

    base = os.environ.get("NOREN_API_BASE", "").rstrip("/")
    public = os.environ.get("NOREN_PUBLIC_KEY", "")
    secret = os.environ.get("NOREN_SECRET_KEY", "")
    project_id = os.environ.get("NOREN_PROJECT_ID", "")

    if not base or not public or not secret or not project_id:
        print(
            "Задайте NOREN_API_BASE, NOREN_PUBLIC_KEY, NOREN_SECRET_KEY, NOREN_PROJECT_ID "
            "(в переменных окружения или в .env рядом со скриптом).",
            file=sys.stderr,
        )
        return 2

    try:
        rates = fetch_rates(base, public, secret)
    except Exception as exc:
        print(f"Не удалось получить /rates: {exc}", file=sys.stderr)
        return 1

    print_active_assets(rates)

    try:
        crypto, network = pick_doge_network(rates)
    except LookupError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    order_id = f"demo-doge-{uuid.uuid4().hex[:12]}"

    try:
        invoice = create_invoice(
            base,
            public,
            secret,
            project_id=project_id,
            merchant_order_id=order_id,
            amount_usd="15.00",
            crypto_currency=crypto,
            network=network,
        )
    except Exception as exc:
        print(f"Не удалось создать инвойс: {exc}", file=sys.stderr)
        return 1

    print("=== Инвойс на 5 USD (DOGE) ===\n")
    print(json.dumps(invoice, indent=2, ensure_ascii=False))
    print("\n--- К оплате ---")
    print(f"  Сумма в крипте: {invoice.get('amount_crypto')} {invoice.get('crypto_currency')}")
    print(f"  Сеть:          {invoice.get('network')}")
    print(f"  Адрес:         {invoice.get('payment_address')}")
    if invoice.get("qr_url"):
        print(f"  QR URL:       {invoice.get('qr_url')}")
    print(f"  Статус:       {invoice.get('status')}")
    print(f"  Истекает:     {invoice.get('expires_at')}")
    print(f"  ID инвойса:   {invoice.get('id')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
