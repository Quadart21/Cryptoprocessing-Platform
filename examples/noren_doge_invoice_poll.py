#!/usr/bin/env python3
"""
Создание инвойса на 15 DOGE и опрос статуса оплаты через Noren Merchant API.

Документация: https://docs.noren.digital/
OpenAPI:       https://noren.digital/openapi.json

Поток (quickstart):
  1. GET  /health          — проверка доступности API
  2. GET  /rates           — доступные валюты и сети
  3. POST /invoices        — создание инвойса
  4. GET  /invoices/{id}   — текущий статус
  5. POST /invoices/{id}/sync — принудительная синхронизация с провайдером

Переменные (окружение или .env рядом со скриптом):
  NOREN_API_BASE       — https://noren.digital
  NOREN_PUBLIC_KEY     — pk_live_...
  NOREN_SECRET_KEY     — sk_live_...
  NOREN_PROJECT_ID     — UUID проекта

Опционально:
  NOREN_INVOICE_AMOUNT — сумма в DOGE (по умолчанию 15)
  NOREN_POLL_INTERVAL  — интервал опроса в секундах (по умолчанию 10)
  NOREN_CRYPTO_CURRENCY — fallback, если /rates недоступен (по умолчанию DOGE)
  NOREN_NETWORK        — fallback-сеть (по умолчанию DOGE)
  NOREN_RATES_RETRIES  — число повторов /rates при 5xx (по умолчанию 3)
  NOREN_USER_AGENT     — User-Agent для обхода WAF
"""

from __future__ import annotations

import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

DEFAULT_AMOUNT_DOGE = "15"
DEFAULT_POLL_INTERVAL_SEC = 10
DEFAULT_CRYPTO_CURRENCY = "DOGE"
DEFAULT_NETWORK = "DOGE"
DEFAULT_RATES_RETRIES = 3
DEFAULT_RATES_RETRY_DELAY_SEC = 2
PAID_STATUSES = frozenset({"paid", "confirmed"})
TERMINAL_STATUSES = frozenset({"paid", "confirmed", "expired", "cancelled", "failed"})

_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def log(message: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {message}", flush=True)


def load_env_file(env_path: Path) -> None:
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def _http_headers(extra: dict[str, str]) -> dict[str, str]:
    merged: dict[str, str] = {
        "User-Agent": os.environ.get("NOREN_USER_AGENT", _DEFAULT_UA).strip() or _DEFAULT_UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": os.environ.get("NOREN_ACCEPT_LANGUAGE", "en-US,en;q=0.9,ru;q=0.8"),
    }
    merged.update(extra)
    return merged


def api_request(
    method: str,
    url: str,
    *,
    public: str,
    secret: str,
    body: dict[str, Any] | None = None,
    auth: bool = True,
) -> Any:
    headers: dict[str, str] = {}
    if auth:
        headers["X-API-Key"] = public
        headers["X-API-Secret"] = secret
    if body is not None:
        headers["Content-Type"] = "application/json"

    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = Request(url, data=data, method=method, headers=_http_headers(headers))
    log(f">>> {method} {url}")
    if body is not None:
        log(f"    body: {json.dumps(body, ensure_ascii=False)}")

    try:
        with urlopen(req, timeout=60) as resp:
            payload = resp.read().decode("utf-8") or "{}"
            parsed = json.loads(payload)
            log(f"<<< HTTP {resp.status}")
            return parsed
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        log(f"<<< HTTP {exc.code}: {detail}")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc


def check_health(base: str) -> dict[str, Any]:
    return api_request(
        "GET",
        f"{base}/api/v1/client/health",
        public="",
        secret="",
        auth=False,
    )


def explain_api_error(exc: Exception) -> str:
    text = str(exc)
    if "provider_error" not in text and "internal_error" not in text:
        return text
    try:
        payload = json.loads(text.split(": ", 1)[-1])
    except json.JSONDecodeError:
        return (
            f"{text}\n"
            "Похоже на сбой платёжного провайдера на стороне noren.digital. "
            "Ваши API-ключи при этом могут быть в порядке — проверьте GET /balance и GET /invoices."
        )

    detail = payload.get("detail")
    if isinstance(detail, dict) and detail.get("code") == "provider_error":
        errors = detail.get("provider_errors") or []
        path = detail.get("path") or "unknown"
        provider_code = str(detail.get("provider_code") or "")
        joined_errors = " ".join(str(item) for item in errors)

        if provider_code == "4003" or "Operation is not allowed for this API key" in joined_errors:
            return (
                "Crypto-Cash отклонил создание инвойса (код 4003): "
                "операция sale не разрешена для платформенного API-ключа на маршруте DOGE. "
                "Ваши Noren-ключи (pk_live/sk_live) здесь ни при чём — "
                "нужно, чтобы поддержка Noren включила приём DOGE в Crypto-Cash "
                "или выдала ключ с правом balance/actions/sale для DOGE."
            )
        if "2020" in joined_errors or "/crypto-currencies/list" in path:
            return (
                f"Crypto-Cash не отдаёт список валют ({path}, errors={errors}). "
                "Из-за этого падают GET /rates и POST /invoices. "
                "Обратитесь в поддержку Noren — нужно восстановить интеграцию с Crypto-Cash."
            )
        if "/balance/actions/sale" in path:
            return (
                f"Crypto-Cash отклонил создание платежа ({path}, errors={errors}). "
                "GET /rates может работать, но POST /invoices недоступен. "
                "Обратитесь в поддержку Noren с этим текстом ошибки."
            )
        return (
            f"Ошибка платёжного провайдера Crypto-Cash ({path}, errors={errors}). "
            "Обратитесь в поддержку Noren с полным логом запроса."
        )
    if isinstance(detail, str) and "Internal server error" in detail:
        return (
            "Сервер noren.digital вернул 500 на GET /rates. "
            "Обычно это означает сбой провайдера Crypto-Cash при загрузке списка валют. "
            "Скрипт попробует fallback DOGE/DOGE из env, но создание инвойса тоже может упасть, "
            "пока провайдер не починят."
        )
    return text


def fetch_rates_with_retry(
    base: str,
    public: str,
    secret: str,
    *,
    retries: int,
    retry_delay: int,
) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return fetch_rates(base, public, secret)
        except Exception as exc:
            last_error = exc
            if attempt >= retries or "HTTP 5" not in str(exc):
                break
            log(f"/rates вернул ошибку, повтор {attempt}/{retries} через {retry_delay} с...")
            time.sleep(retry_delay)
    assert last_error is not None
    raise last_error


def resolve_crypto_route(
    base: str,
    public: str,
    secret: str,
    *,
    fallback_crypto: str,
    fallback_network: str,
    rates_retries: int,
    rates_retry_delay: int,
) -> tuple[str, str, str]:
    try:
        rates = fetch_rates_with_retry(
            base,
            public,
            secret,
            retries=rates_retries,
            retry_delay=rates_retry_delay,
        )
        crypto, network = pick_doge_network(rates)
        return crypto, network, "rates"
    except Exception as exc:
        crypto = fallback_crypto.strip().upper()
        network = fallback_network.strip().upper()
        log(f"/rates недоступен: {explain_api_error(exc)}")
        log(f"Использую fallback из env: {crypto}/{network}")
        return crypto, network, "fallback"


def fetch_rates(base: str, public: str, secret: str) -> dict[str, Any]:
    return api_request("GET", f"{base}/api/v1/client/rates", public=public, secret=secret)


def resolve_project_id(base: str, public: str, secret: str, configured: str) -> str:
    if configured:
        return configured
    log("NOREN_PROJECT_ID не задан — определяю по API-ключу через GET /invoices")
    invoices = api_request(
        "GET",
        f"{base}/api/v1/client/invoices?limit=1",
        public=public,
        secret=secret,
    )
    if isinstance(invoices, list) and invoices:
        project_id = str(invoices[0].get("project_id") or "")
        if project_id:
            log(f"Найден project_id: {project_id}")
            return project_id
    raise RuntimeError(
        "Не удалось определить project_id. Укажите NOREN_PROJECT_ID из кабинета мерчанта."
    )


def pick_doge_network(rates: dict[str, Any]) -> tuple[str, str]:
    for item in rates.get("items") or []:
        currency = str(item.get("currency") or "").upper()
        if currency != "DOGE":
            continue
        for network_item in item.get("networks") or []:
            if network_item.get("client_available") and network_item.get("acquiring"):
                network = str(network_item.get("network") or "").upper()
                if network:
                    return currency, network
    raise LookupError(
        "DOGE недоступен для приёма на вашем аккаунте. "
        "Доступные валюты: "
        + ", ".join(
            f"{item.get('currency')}/{n.get('network')}"
            for item in rates.get("items") or []
            for n in item.get("networks") or []
            if n.get("client_available") and n.get("acquiring")
        )
        + ". Попросите поддержку включить DOGE."
    )


def create_invoice(
    base: str,
    public: str,
    secret: str,
    *,
    project_id: str,
    merchant_order_id: str,
    amount_doge: str,
    crypto_currency: str,
    network: str,
) -> dict[str, Any]:
    body = {
        "project_id": project_id,
        "merchant_order_id": merchant_order_id,
        "amount_fiat": amount_doge,
        "fiat_currency": "USD",
        "crypto_currency": crypto_currency,
        "network": network,
        "metadata": {"source": "examples/noren_doge_invoice_poll.py"},
    }
    return api_request(
        "POST",
        f"{base}/api/v1/client/invoices",
        public=public,
        secret=secret,
        body=body,
    )


def get_invoice(base: str, public: str, secret: str, invoice_id: str) -> dict[str, Any]:
    return api_request(
        "GET",
        f"{base}/api/v1/client/invoices/{invoice_id}",
        public=public,
        secret=secret,
    )


def sync_invoice(base: str, public: str, secret: str, invoice_id: str) -> dict[str, Any]:
    return api_request(
        "POST",
        f"{base}/api/v1/client/invoices/{invoice_id}/sync",
        public=public,
        secret=secret,
    )


def print_invoice_details(invoice: dict[str, Any], *, title: str) -> None:
    log(title)
    log(f"    ID:              {invoice.get('id')}")
    log(f"    merchant_order:  {invoice.get('merchant_order_id')}")
    log(f"    status:          {invoice.get('status')}")
    log(f"    amount_crypto:   {invoice.get('amount_crypto')} {invoice.get('crypto_currency')}")
    log(f"    network:         {invoice.get('network')}")
    log(f"    payment_address: {invoice.get('payment_address')}")
    if invoice.get("qr_url"):
        log(f"    qr_url:          {invoice.get('qr_url')}")
    log(f"    expires_at:      {invoice.get('expires_at')}")


def poll_until_paid(
    base: str,
    public: str,
    secret: str,
    invoice_id: str,
    *,
    poll_interval: int,
    expires_at_raw: str | None,
) -> dict[str, Any]:
    log(f"Начинаю опрос каждые {poll_interval} с (GET /invoices/{{id}} + POST /sync)")
    attempt = 0

    while True:
        attempt += 1
        log(f"--- Опрос #{attempt} ---")

        try:
            synced = sync_invoice(base, public, secret, invoice_id)
            status = str(synced.get("status") or "").lower()
            log(f"    sync -> status={status}")
        except Exception as exc:
            log(f"    sync ошибка: {exc}")
            synced = get_invoice(base, public, secret, invoice_id)
            status = str(synced.get("status") or "").lower()
            log(f"    get  -> status={status}")

        if status in PAID_STATUSES:
            log("Оплата получена.")
            return synced

        if status in TERMINAL_STATUSES:
            log(f"Инвойс в финальном статусе: {status}")
            return synced

        if expires_at_raw:
            try:
                expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) >= expires_at:
                    log("Срок действия инвойса истёк.")
                    return synced
            except ValueError:
                pass

        log(f"Ожидание оплаты... следующий опрос через {poll_interval} с")
        time.sleep(poll_interval)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    load_env_file(Path(__file__).resolve().parent / ".env")

    base = os.environ.get("NOREN_API_BASE", "").rstrip("/")
    public = os.environ.get("NOREN_PUBLIC_KEY", "")
    secret = os.environ.get("NOREN_SECRET_KEY", "")
    project_id = os.environ.get("NOREN_PROJECT_ID", "")
    amount_doge = os.environ.get("NOREN_INVOICE_AMOUNT", DEFAULT_AMOUNT_DOGE)
    poll_interval = int(os.environ.get("NOREN_POLL_INTERVAL", str(DEFAULT_POLL_INTERVAL_SEC)))
    fallback_crypto = os.environ.get("NOREN_CRYPTO_CURRENCY", DEFAULT_CRYPTO_CURRENCY)
    fallback_network = os.environ.get("NOREN_NETWORK", DEFAULT_NETWORK)
    rates_retries = int(os.environ.get("NOREN_RATES_RETRIES", str(DEFAULT_RATES_RETRIES)))
    rates_retry_delay = int(
        os.environ.get("NOREN_RATES_RETRY_DELAY", str(DEFAULT_RATES_RETRY_DELAY_SEC))
    )

    if not base or not public or not secret:
        log(
            "Задайте NOREN_API_BASE, NOREN_PUBLIC_KEY, NOREN_SECRET_KEY "
            "(в переменных окружения или в .env рядом со скриптом)."
        )
        return 2

    project_id = resolve_project_id(base, public, secret, project_id)

    log("=== Noren: инвойс 15 DOGE + опрос оплаты ===")
    log(f"Base URL: {base}")

    try:
        health = check_health(base)
        log(f"Health OK: {json.dumps(health, ensure_ascii=False)}")
    except Exception as exc:
        log(f"Health check failed: {exc}")
        return 1

    crypto, network, route_source = resolve_crypto_route(
        base,
        public,
        secret,
        fallback_crypto=fallback_crypto,
        fallback_network=fallback_network,
        rates_retries=rates_retries,
        rates_retry_delay=rates_retry_delay,
    )
    log(f"Маршрут оплаты: {crypto}/{network} (источник: {route_source})")

    order_id = f"doge-{uuid.uuid4().hex[:12]}"
    log(f"Создаю инвойс на {amount_doge} DOGE (order_id={order_id})")

    try:
        invoice = create_invoice(
            base,
            public,
            secret,
            project_id=project_id,
            merchant_order_id=order_id,
            amount_doge=amount_doge,
            crypto_currency=crypto,
            network=network,
        )
    except Exception as exc:
        log(f"Не удалось создать инвойс: {explain_api_error(exc)}")
        return 1

    print_invoice_details(invoice, title="Инвойс создан:")
    log("")
    log("Отправьте указанную сумму DOGE на payment_address и дождитесь подтверждения.")
    log("")

    invoice_id = str(invoice.get("id") or "")
    if not invoice_id:
        log("Ответ не содержит id инвойса.")
        return 1

    try:
        final = poll_until_paid(
            base,
            public,
            secret,
            invoice_id,
            poll_interval=poll_interval,
            expires_at_raw=invoice.get("expires_at"),
        )
    except KeyboardInterrupt:
        log("Остановлено пользователем (Ctrl+C).")
        return 130

    print_invoice_details(final, title="Итоговый статус:")
    status = str(final.get("status") or "").lower()
    if status in PAID_STATUSES:
        log("Готово: платёж подтверждён.")
        return 0

    log(f"Завершено без оплаты (status={status}).")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
