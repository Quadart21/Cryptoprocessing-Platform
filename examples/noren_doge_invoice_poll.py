#!/usr/bin/env python3
"""
Создание инвойса на 15 DOGE и опрос статуса оплаты через Noren Merchant API.

Документация: https://docs.noren.digital/
OpenAPI:       https://noren.digital/openapi.json

Поток (quickstart):
  1. GET  /health          — проверка доступности API
  2. GET  /rates           — доступные валюты и сети
  3. POST /invoices        — создание инвойса
  4. GET  /invoices/{id}   — текущий статус (+ network_confirmations_actual/required)
  5. POST /invoices/{id}/sync — принудительная синхронизация с провайдером

Статусы инвойса (после маппинга Crypto-Cash):
  pending    — ждём перевод на адрес
  confirming — транзакция в сети, идут подтверждения блокчейна (Waiting у CC)
  paid       — депозит принят провайдером
  confirmed  — финальное подтверждение

Поля подтверждений в ответе API:
  network_confirmations_actual   — сколько блоков уже подтверждено (например 7)
  network_confirmations_required — сколько нужно для сети (DOGE: 15)

Hosted checkout (docs): в ответе POST /invoices поле payment_page_url —
  https://noren.digital/pay/{token} (QR, таймер, автообновление статуса).
  Зависит от checkout_delivery проекта: payment_page | h2h | both.

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
  NOREN_RATES_TIMEOUT  — таймаут /rates в секундах (по умолчанию 15)
  NOREN_HTTP_TIMEOUT   — таймаут остальных запросов (по умолчанию 30)
  NOREN_SKIP_RATES     — 1 = не вызывать /rates, сразу DOGE/DOGE из env
  NOREN_API_ERROR_BACKOFF — пауза при 502/503/504 (по умолчанию 60)
  NOREN_PAYMENT_HTML   — путь к локальному HTML (по умолчанию last_payment.html)
  NOREN_USER_AGENT     — User-Agent для обхода WAF
  NOREN_SUCCESS_STATUSES — через запятую: статусы успеха (по умолчанию paid,confirmed)
"""

from __future__ import annotations

import json
import os
import sys
import time
import uuid
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_AMOUNT_DOGE = "20"
DEFAULT_POLL_INTERVAL_SEC = 10
DEFAULT_CRYPTO_CURRENCY = "DOGE"
DEFAULT_NETWORK = "DOGE"
DEFAULT_RATES_RETRIES = 1
DEFAULT_RATES_RETRY_DELAY_SEC = 2
DEFAULT_RATES_TIMEOUT_SEC = 15
DEFAULT_HTTP_TIMEOUT_SEC = 30
CONFIRMING_STATUS = "confirming"
RETRYABLE_HTTP_CODES = frozenset({502, 503, 504, 429})
DEFAULT_API_ERROR_BACKOFF_SEC = 60
DEFAULT_SUCCESS_STATUSES = frozenset({"paid", "confirmed"})
TERMINAL_STATUSES = frozenset({"expired", "cancelled", "failed"})

_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def log(message: str) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
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


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw.isdigit() else default


def _env_bool(name: str, *, default: bool = False) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _env_status_set(name: str, default: frozenset[str]) -> frozenset[str]:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    values = {part.strip().lower() for part in raw.split(",") if part.strip()}
    return frozenset(values) if values else default


def format_confirmations(invoice: dict[str, Any]) -> str | None:
    actual = invoice.get("network_confirmations_actual")
    required = invoice.get("network_confirmations_required")
    if actual is None and required is None:
        return None
    try:
        actual_int = int(actual) if actual is not None else None
    except (TypeError, ValueError):
        actual_int = None
    try:
        required_int = int(required) if required is not None else None
    except (TypeError, ValueError):
        required_int = None
    if required_int is not None and required_int > 0:
        return f"{actual_int or 0}/{required_int}"
    if actual_int is not None:
        return str(actual_int)
    return None


def is_retryable_api_error(exc: Exception) -> bool:
    text = str(exc).lower()
    if "timeout" in text or "network error" in text:
        return True
    for code in RETRYABLE_HTTP_CODES:
        if f"http {code}" in text or f'"status":{code}' in text or f'"status": {code}' in text:
            return True
    if "cloudflare" in text or "bad gateway" in text or "retryable" in text:
        return True
    return False


def api_error_backoff_seconds(exc: Exception) -> int:
    text = str(exc)
    try:
        payload = json.loads(text.split(": ", 1)[-1])
        retry_after = payload.get("retry_after")
        if isinstance(retry_after, (int, float)) and retry_after > 0:
            return int(retry_after)
    except (json.JSONDecodeError, ValueError, IndexError):
        pass
    return _env_int("NOREN_API_ERROR_BACKOFF", DEFAULT_API_ERROR_BACKOFF_SEC)


def fetch_invoice_snapshot(
    base: str,
    public: str,
    secret: str,
    invoice_id: str,
) -> tuple[dict[str, Any] | None, str | None, Exception | None]:
    """sync, затем GET; при временной ошибке API возвращает (None, None, exc)."""
    last_error: Exception | None = None
    for source, fetcher in (
        ("sync", lambda: sync_invoice(base, public, secret, invoice_id)),
        ("get", lambda: get_invoice(base, public, secret, invoice_id)),
    ):
        try:
            return fetcher(), source, None
        except Exception as exc:
            last_error = exc
            log(f"    {source} ошибка: {short_api_error(exc)}")
            if not is_retryable_api_error(exc):
                break
    return None, None, last_error


def short_api_error(exc: Exception) -> str:
    text = str(exc)
    if "HTTP 502" in text or "502" in text:
        return "HTTP 502 Bad Gateway (Cloudflare / origin перегружен) — повторим позже"
    if "HTTP 503" in text:
        return "HTTP 503 Service Unavailable — повторим позже"
    if "HTTP 504" in text:
        return "HTTP 504 Gateway Timeout — повторим позже"
    if len(text) > 200:
        return text[:200] + "..."
    return text


def describe_status(status: str, confirmations: str | None) -> str:
    normalized = status.strip().lower()
    if normalized == CONFIRMING_STATUS:
        suffix = f" ({confirmations})" if confirmations else ""
        return f"подтверждение в сети{suffix}"
    if normalized == "pending":
        return "ожидает оплату"
    if normalized == "paid":
        suffix = f", подтверждения {confirmations}" if confirmations else ""
        return f"оплачен{suffix}"
    if normalized == "confirmed":
        suffix = f", подтверждения {confirmations}" if confirmations else ""
        return f"подтверждён{suffix}"
    return normalized or "unknown"


def api_request(
    method: str,
    url: str,
    *,
    public: str,
    secret: str,
    body: dict[str, Any] | None = None,
    auth: bool = True,
    timeout: int | None = None,
    wait_hint: str | None = None,
) -> Any:
    if timeout is None:
        timeout = _env_int("NOREN_HTTP_TIMEOUT", DEFAULT_HTTP_TIMEOUT_SEC)
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
    if wait_hint:
        log(wait_hint)

    try:
        with urlopen(req, timeout=timeout) as resp:
            payload = resp.read().decode("utf-8") or "{}"
            parsed = json.loads(payload)
            log(f"<<< HTTP {resp.status}")
            return parsed
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        log(f"<<< HTTP {exc.code}: {detail}")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        reason = exc.reason
        if isinstance(reason, TimeoutError) or "timed out" in str(reason).lower():
            log(f"<<< timeout после {timeout} с")
            raise RuntimeError(f"timeout после {timeout} с: {url}") from exc
        log(f"<<< сетевая ошибка: {reason}")
        raise RuntimeError(f"network error: {reason}") from exc


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
    if "timeout" in text.lower():
        return (
            "GET /rates не ответил вовремя — Noren ждёт Crypto-Cash, и запрос зависает на стороне сервера. "
            "Скрипт переключится на fallback DOGE/DOGE из env. "
            "Чтобы не ждать /rates вообще, задайте NOREN_SKIP_RATES=1 в .env."
        )
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
            "Сервер noren.digital вернул 500 (internal_error). "
            "Это внутренняя ошибка платформы, а не ваших API-ключей. "
            "Частые причины: сбой Crypto-Cash, ошибка деплоя или некорректный ответ провайдера. "
            "Проверьте, что на сервере установлена последняя версия (v0.14.52+), "
            "и обратитесь в поддержку Noren с временем запроса из лога."
        )
    return text


def fetch_rates_with_retry(
    base: str,
    public: str,
    secret: str,
    *,
    retries: int,
    retry_delay: int,
    timeout: int,
) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return fetch_rates(base, public, secret, timeout=timeout)
        except Exception as exc:
            last_error = exc
            retryable = "HTTP 5" in str(exc) or "timeout" in str(exc).lower()
            if attempt >= retries or not retryable:
                break
            log(f"/rates не ответил, повтор {attempt}/{retries} через {retry_delay} с...")
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
    rates_timeout: int,
    skip_rates: bool,
) -> tuple[str, str, str]:
    if skip_rates:
        crypto = fallback_crypto.strip().upper()
        network = fallback_network.strip().upper()
        log(f"NOREN_SKIP_RATES=1 — пропускаю /rates, использую {crypto}/{network}")
        return crypto, network, "env"

    try:
        rates = fetch_rates_with_retry(
            base,
            public,
            secret,
            retries=rates_retries,
            retry_delay=rates_retry_delay,
            timeout=rates_timeout,
        )
        crypto, network = pick_doge_network(rates)
        return crypto, network, "rates"
    except Exception as exc:
        crypto = fallback_crypto.strip().upper()
        network = fallback_network.strip().upper()
        log(f"/rates недоступен: {explain_api_error(exc)}")
        log(f"Использую fallback из env: {crypto}/{network}")
        return crypto, network, "fallback"


def fetch_rates(base: str, public: str, secret: str, *, timeout: int | None = None) -> dict[str, Any]:
    rates_timeout = timeout if timeout is not None else _env_int(
        "NOREN_RATES_TIMEOUT", DEFAULT_RATES_TIMEOUT_SEC
    )
    return api_request(
        "GET",
        f"{base}/api/v1/client/rates",
        public=public,
        secret=secret,
        timeout=rates_timeout,
        wait_hint=(
            f"    ожидание ответа /rates (до {rates_timeout} с) — "
            "сервер запрашивает список валют у Crypto-Cash..."
        ),
    )


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
    status = str(invoice.get("status") or "")
    confirmations = format_confirmations(invoice)
    log(title)
    log(f"    ID:              {invoice.get('id')}")
    log(f"    merchant_order:  {invoice.get('merchant_order_id')}")
    log(f"    status:          {status} ({describe_status(status, confirmations)})")
    if confirmations:
        log(f"    confirmations:   {confirmations}")
    log(f"    checkout:        {invoice.get('checkout_delivery')}")
    log(f"    amount_crypto:   {invoice.get('amount_crypto')} {invoice.get('crypto_currency')}")
    log(f"    network:         {invoice.get('network')}")
    if invoice.get("payment_page_url"):
        log(f"    payment_page:    {invoice.get('payment_page_url')}")
    if invoice.get("payment_address"):
        log(f"    payment_address: {invoice.get('payment_address')}")
    if invoice.get("qr_url"):
        log(f"    qr_url:          {invoice.get('qr_url')}")
    log(f"    expires_at:      {invoice.get('expires_at')}")


def _payment_html_path() -> Path:
    configured = os.environ.get("NOREN_PAYMENT_HTML", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parent / "last_payment.html"


def write_payment_html(invoice: dict[str, Any]) -> Path:
    page_url = str(invoice.get("payment_page_url") or "").strip()
    address = str(invoice.get("payment_address") or "")
    qr_url = str(invoice.get("qr_url") or "")
    amount = invoice.get("amount_crypto")
    currency = invoice.get("crypto_currency")
    network = invoice.get("network")
    status = invoice.get("status")
    expires = invoice.get("expires_at")
    order_id = invoice.get("merchant_order_id")
    confirmations = format_confirmations(invoice)
    confirm_line = (
        f"<p>Подтверждения сети: <strong>{confirmations}</strong></p>"
        if confirmations
        else ""
    )

    if page_url:
        body = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url={page_url}">
  <title>Оплата {amount} {currency}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; }}
    a {{ color: #2563eb; }}
    .box {{ border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }}
  </style>
</head>
<body>
  <div class="box">
    <h1>Оплата {amount} {currency}</h1>
    <p>Заказ: <code>{order_id}</code></p>
    <p>Статус: <strong>{status}</strong></p>
    {confirm_line}
    <p>Истекает: {expires}</p>
    <p><a href="{page_url}">Открыть платёжную страницу Noren</a></p>
    <p>Если редирект не сработал, перейдите по ссылке вручную.</p>
  </div>
</body>
</html>"""
    else:
        qr_block = (
            f'<p><img src="{qr_url}" alt="QR" width="220" height="220"></p>'
            if qr_url
            else ""
        )
        body = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Оплата {amount} {currency}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; }}
    code {{ word-break: break-all; }}
    .box {{ border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }}
  </style>
</head>
<body>
  <div class="box">
    <h1>Оплата {amount} {currency} ({network})</h1>
    <p>Заказ: <code>{order_id}</code></p>
    <p>Статус: <strong>{status}</strong></p>
    {confirm_line}
    <p>Сумма: <strong>{amount} {currency}</strong></p>
    <p>Адрес:</p>
    <p><code>{address}</code></p>
    {qr_block}
    <p>Истекает: {expires}</p>
  </div>
</body>
</html>"""

    out = _payment_html_path()
    out.write_text(body, encoding="utf-8")
    return out


def display_payment_page(invoice: dict[str, Any]) -> None:
    page_url = str(invoice.get("payment_page_url") or "").strip()
    html_path = write_payment_html(invoice)

    log("")
    log("=" * 60)
    log("  ПЛАТЁЖНАЯ СТРАНИЦА")
    log("=" * 60)
    if page_url:
        log(f"  URL:  {page_url}")
        log("  (hosted checkout: QR, таймер, автообновление статуса)")
    else:
        log("  payment_page_url не вернулся (checkout_delivery=h2h).")
        log(f"  Локальная страница с адресом и QR: file:///{html_path.as_posix()}")
    log(f"  HTML: file:///{html_path.as_posix()}")
    log("=" * 60)
    log("")

    if _env_bool("NOREN_OPEN_BROWSER", default=True):
        target = page_url or html_path.as_uri()
        log(f"Открываю в браузере: {target}")
        try:
            webbrowser.open(target, new=2)
        except Exception as exc:
            log(f"Не удалось открыть браузер: {exc}")


def poll_until_paid(
    base: str,
    public: str,
    secret: str,
    invoice_id: str,
    *,
    poll_interval: int,
    expires_at_raw: str | None,
    success_statuses: frozenset[str],
) -> dict[str, Any]:
    log(
        f"Начинаю опрос каждые {poll_interval} с (POST /sync + GET /invoices/{{id}}). "
        f"Успех при status in {{{', '.join(sorted(success_statuses))}}}"
    )
    attempt = 0
    consecutive_api_errors = 0
    last_status: str | None = None
    last_confirmations: str | None = None
    last_snapshot: dict[str, Any] | None = None

    while True:
        attempt += 1
        log(f"--- Опрос #{attempt} ---")

        synced, source, api_error = fetch_invoice_snapshot(base, public, secret, invoice_id)
        if synced is None:
            consecutive_api_errors += 1
            backoff = api_error_backoff_seconds(api_error) if api_error else poll_interval
            log(
                f"    API временно недоступен ({consecutive_api_errors} подряд). "
                f"Пауза {backoff} с, затем повтор (Ctrl+C для выхода)."
            )
            if last_snapshot is not None:
                log(
                    f"    последний известный статус: {last_snapshot.get('status')} "
                    f"({describe_status(str(last_snapshot.get('status') or ''), format_confirmations(last_snapshot))})"
                )
            time.sleep(backoff)
            continue

        consecutive_api_errors = 0
        last_snapshot = synced
        status = str(synced.get("status") or "").lower()
        confirmations = format_confirmations(synced)
        if status != last_status or confirmations != last_confirmations:
            log(f"    {source} -> status={status} ({describe_status(status, confirmations)})")
            if confirmations:
                log(f"    confirmations:   {confirmations}")
            last_status = status
            last_confirmations = confirmations

        if status == CONFIRMING_STATUS:
            log("    транзакция в блокчейне — ждём накопления подтверждений сети")
        elif status == "pending":
            log("    ждём входящий перевод на payment_address")

        if status in success_statuses:
            log("Целевой статус достигнут.")
            return synced

        if status in TERMINAL_STATUSES:
            log(f"Инвойс в финальном статусе без оплаты: {status}")
            return synced

        if expires_at_raw:
            try:
                expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) >= expires_at:
                    log("Срок действия инвойса истёк.")
                    return synced
            except ValueError:
                pass

        log(f"Ожидание... следующий опрос через {poll_interval} с")
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
    rates_timeout = _env_int("NOREN_RATES_TIMEOUT", DEFAULT_RATES_TIMEOUT_SEC)
    skip_rates = _env_bool("NOREN_SKIP_RATES")
    success_statuses = _env_status_set("NOREN_SUCCESS_STATUSES", DEFAULT_SUCCESS_STATUSES)

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
        rates_timeout=rates_timeout,
        skip_rates=skip_rates,
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
    display_payment_page(invoice)
    required = invoice.get("network_confirmations_required")
    if required:
        log(f"Для {crypto}/{network} нужно подтверждений сети: {required}")
    if invoice.get("payment_page_url"):
        log(
            "Оплатите по payment_page. После перевода статус сменится "
            "pending → confirming (счётчик блоков) → paid/confirmed."
        )
    else:
        log(
            "Отправьте сумму на payment_address. Скрипт покажет confirming и прогресс N/M."
        )
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
            success_statuses=success_statuses,
        )
    except KeyboardInterrupt:
        log("Остановлено пользователем (Ctrl+C).")
        return 130

    print_invoice_details(final, title="Итоговый статус:")
    status = str(final.get("status") or "").lower()
    confirmations = format_confirmations(final)
    if status in success_statuses:
        if status == "confirmed":
            log("Готово: инвойс полностью подтверждён.")
        elif status == "paid":
            log("Готово: депозит принят (status=paid).")
        else:
            log(f"Готово: достигнут статус {status}.")
        if confirmations:
            log(f"Подтверждения сети на финале: {confirmations}")
        return 0

    log(f"Завершено без целевого статуса (status={status}).")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
