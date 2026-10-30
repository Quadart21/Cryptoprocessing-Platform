#!/usr/bin/env python3
"""
Telegram-бот мерчанта для приёма криптоплатежей через Noren.

Документация: https://docs.noren.digital/
Контракт: ключи → GET /rates → POST /invoices → ссылка /pay/{token} или H2H →
вебхук с HMAC → подтверждение заказа в чате. Статус дополнительно сверяется
через POST /invoices/{id}/sync и GET /invoices/{id}.

Бот не подтверждает блокчейн сам: заказ в чате закрывается, когда Noren присылает
invoice.paid / invoice.confirmed (или sync видит тот же статус).
События webhook.test и invoice.test_deposit (simulated) заказ не закрывают.

Запуск:
  python examples/noren_telegram_pay_bot.py

Окружение (или .env рядом со скриптом и в examples/):
  TELEGRAM_BOT_TOKEN          — токен BotFather
  NOREN_API_BASE              — https://noren.digital
  NOREN_PUBLIC_KEY            — pk_live_...
  NOREN_SECRET_KEY            — sk_live_...
  NOREN_PROJECT_ID            — UUID проекта (если пусто, берётся из GET /invoices)
  NOREN_WEBHOOK_SECRET        — тот же секрет, что в кабинете (HMAC sha256 сырого тела)

Опционально:
  NOREN_WEBHOOK_HOST          — bind, по умолчанию 0.0.0.0
  NOREN_WEBHOOK_PORT          — порт приёмника, по умолчанию 8787
  NOREN_WEBHOOK_PUBLIC_URL    — публичный HTTPS, по умолчанию https://kupik.asia
  NOREN_WEBHOOK_ONLY          — 1: только HTTP-приёмник, без Telegram и ключей API
  NOREN_MERCHANT_EMAIL        — если заданы почта и пароль, бот сам сохранит webhook
  NOREN_MERCHANT_PASSWORD
  NOREN_MERCHANT_OTP          — код 2FA, если включён
  NOREN_FIAT_CURRENCY         — USD
  NOREN_DEFAULT_AMOUNT        — сумма /pay без аргумента, по умолчанию 10
  NOREN_CRYPTO_CURRENCY       — предпочтительный токен, иначе USDT/TRC20 или первый доступный
  NOREN_NETWORK
  NOREN_POLL_INTERVAL         — секунды между sync открытых счетов, по умолчанию 15
  NOREN_SUCCESS_STATUSES      — paid,confirmed
  TELEGRAM_ALLOWED_USER_IDS   — через запятую; пусто = любой пользователь бота
  NOREN_BOT_STATE             — файл состояния заказов
  NOREN_USER_AGENT

Вебхук в кабинете: https://kupik.asia/webhooks/noren
Домен должен резолвиться в публичный IP сервера с ботом и валидным HTTPS.
Сейчас у kupik.asia нет A/AAAA (NS ns1.mitelis.cc / ns2.mitelis.cc).
Заголовок: X-Merset-Signature: sha256=<hex hmac sha256 секрет + сырое тело>
Ответ 2xx только после записи event_id.
"""

from __future__ import annotations

import json
import os
import socket
import threading
import time
import uuid
import hmac
import hashlib
import html
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SUCCESS_STATUSES = frozenset({"paid", "confirmed"})
TERMINAL_STATUSES = frozenset({"expired", "cancelled", "failed"})
SIMULATED_EVENTS = frozenset({"webhook.test", "invoice.test_deposit"})
WEBHOOK_PATHS = frozenset({"/webhooks/noren", "/webhook"})
MAX_WEBHOOK_BODY = 256 * 1024
DEFAULT_WEBHOOK_ORIGIN = "https://kupik.asia"

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


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw.isdigit() else default


def verify_signature(secret: str, body: bytes, signature_header: str | None) -> bool:
    """X-Merset-Signature: sha256=<hex HMAC-SHA256(secret, raw body)>."""
    secret = secret.strip()
    if not secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = signature_header[7:].strip().lower()
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, expected)


def parse_command(text: str) -> tuple[str, str]:
    raw = text.strip()
    if not raw.startswith("/"):
        return "", raw
    head, _, rest = raw.partition(" ")
    command = head.split("@", 1)[0][1:].lower()
    return command, rest.strip()


def parse_pay_args(rest: str, *, default_amount: str, default_crypto: str, default_network: str) -> tuple[str, str, str]:
    parts = rest.split()
    amount = parts[0] if parts else default_amount
    crypto = parts[1].upper() if len(parts) > 1 else default_crypto.upper()
    network = parts[2].upper() if len(parts) > 2 else default_network.upper()
    return amount, crypto, network


def parse_amount(raw: str) -> Decimal:
    try:
        amount = Decimal(raw.replace(",", "."))
    except InvalidOperation as exc:
        raise ValueError("Сумма должна быть числом, например 10 или 12.50.") from exc
    if amount <= 0:
        raise ValueError("Сумма должна быть больше нуля.")
    return amount


def format_confirmations(invoice: dict[str, Any]) -> str | None:
    actual = invoice.get("network_confirmations_actual")
    required = invoice.get("network_confirmations_required")
    if actual is None and required is None:
        return None
    try:
        actual_int = int(actual) if actual is not None else 0
    except (TypeError, ValueError):
        actual_int = 0
    try:
        required_int = int(required) if required is not None else 0
    except (TypeError, ValueError):
        required_int = 0
    if required_int > 0:
        return f"{actual_int}/{required_int}"
    if actual is not None:
        return str(actual_int)
    return None


def describe_status(status: str, confirmations: str | None) -> str:
    normalized = status.strip().lower()
    labels = {
        "pending": "ожидает оплату",
        "confirming": "идёт подтверждение в сети",
        "paid": "оплачен",
        "confirmed": "подтверждён",
        "expired": "истёк",
        "cancelled": "отменён",
        "failed": "ошибка",
    }
    label = labels.get(normalized, normalized or "unknown")
    if confirmations and normalized in {"confirming", "paid", "confirmed"}:
        return f"{label} ({confirmations})"
    return label


def pick_route(rates: dict[str, Any], crypto: str, network: str) -> tuple[str, str]:
    options: list[tuple[str, str]] = []
    for item in rates.get("items") or []:
        currency = str(item.get("currency") or "").upper()
        for net in item.get("networks") or []:
            if not net.get("client_available") or not net.get("acquiring"):
                continue
            net_name = str(net.get("network") or "").upper()
            if currency and net_name:
                options.append((currency, net_name))
    if not options:
        raise LookupError("Нет доступных сетей для приёма. Проверьте GET /rates в кабинете.")

    wanted_crypto = crypto.strip().upper()
    wanted_network = network.strip().upper()
    if wanted_crypto and wanted_network:
        for currency, net_name in options:
            if currency == wanted_crypto and net_name == wanted_network:
                return currency, net_name
        available = ", ".join(f"{c}/{n}" for c, n in options)
        raise LookupError(f"{wanted_crypto}/{wanted_network} недоступен. Доступно: {available}")
    if wanted_crypto:
        for currency, net_name in options:
            if currency == wanted_crypto:
                return currency, net_name
        available = ", ".join(f"{c}/{n}" for c, n in options)
        raise LookupError(f"{wanted_crypto} недоступен. Доступно: {available}")
    for currency, net_name in options:
        if currency == "USDT" and net_name == "TRC20":
            return currency, net_name
    return options[0]


def webhook_target(public_url: str) -> str:
    public = (public_url or DEFAULT_WEBHOOK_ORIGIN).strip().rstrip("/")
    if public.endswith("/webhooks/noren") or public.endswith("/webhook"):
        return public
    return f"{public}/webhooks/noren"


def describe_webhook_dns(url: str) -> str | None:
    host = (urlparse(url).hostname or "").strip()
    if not host:
        return "В webhook URL нет хоста."
    try:
        socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return (
            f"{host} не резолвится: нет A/AAAA-записи. "
            "NS домена: ns1.mitelis.cc и ns2.mitelis.cc. "
            "Добавьте A-запись на публичный IP сервера с ботом и выпустите HTTPS, "
            "иначе Noren отклонит webhook («hostname could not be resolved»)."
        )
    return None


def payment_token(payment_page_url: str | None) -> str | None:
    if not payment_page_url:
        return None
    path = urlparse(payment_page_url).path.rstrip("/")
    marker = "/pay/"
    index = path.rfind(marker)
    if index < 0:
        return None
    token = path[index + len(marker) :]
    return token or None


def _esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def invoice_message(invoice: dict[str, Any], *, title: str, order_note: str | None = None) -> str:
    status = str(invoice.get("status") or "")
    confirmations = format_confirmations(invoice)
    lines = [
        f"<b>{_esc(title)}</b>",
        f"Заказ: <code>{_esc(invoice.get('merchant_order_id'))}</code>",
        f"Счёт: <code>{_esc(invoice.get('id'))}</code>",
        f"Статус: {_esc(describe_status(status, confirmations))}",
        (
            f"К оплате: <b>{_esc(invoice.get('amount_fiat'))} {_esc(invoice.get('fiat_currency'))}</b> "
            f"→ {_esc(invoice.get('amount_crypto'))} {_esc(invoice.get('crypto_currency'))} "
            f"({_esc(invoice.get('network'))})"
        ),
    ]
    if invoice.get("payment_page_url"):
        lines.append(f"Ссылка: {_esc(invoice.get('payment_page_url'))}")
    if invoice.get("payment_address"):
        lines.append(f"Адрес: <code>{_esc(invoice.get('payment_address'))}</code>")
    if invoice.get("payment_memo"):
        lines.append(f"Memo: <code>{_esc(invoice.get('payment_memo'))}</code>")
    if invoice.get("expires_at"):
        lines.append(f"Действует до: {_esc(invoice.get('expires_at'))}")
    if order_note:
        lines.append(order_note)
    return "\n".join(lines)


def payment_keyboard(invoice: dict[str, Any]) -> dict[str, Any] | None:
    rows: list[list[dict[str, str]]] = []
    page = str(invoice.get("payment_page_url") or "")
    if page.startswith("http://") or page.startswith("https://"):
        rows.append([{"text": "Оплатить", "url": page}])
    qr = str(invoice.get("qr_url") or "")
    if qr.startswith("http://") or qr.startswith("https://"):
        rows.append([{"text": "QR", "url": qr}])
    if not rows:
        return None
    return {"inline_keyboard": rows}


def short_api_error(exc: Exception) -> str:
    text = str(exc)
    try:
        payload = json.loads(text.split(": ", 1)[-1])
    except (json.JSONDecodeError, IndexError):
        payload = None
    if isinstance(payload, dict):
        detail = payload.get("detail")
        if isinstance(detail, dict):
            message = detail.get("message") or detail.get("code")
            if message:
                return str(message)
        if isinstance(detail, str) and detail:
            return detail
    if len(text) > 400:
        return text[:400] + "..."
    return text


@dataclass
class Outbound:
    chat_id: int
    text: str
    reply_markup: dict[str, Any] | None = None


@dataclass
class Order:
    merchant_order_id: str
    invoice_id: str
    chat_id: int
    amount_fiat: str
    fiat_currency: str
    crypto_currency: str
    network: str
    amount_crypto: str
    status: str
    payment_page_url: str | None = None
    payment_address: str | None = None
    payment_memo: str | None = None
    qr_url: str | None = None
    expires_at: str | None = None
    fulfilled: bool = False
    notified_status: str = ""
    notified_confirmations: str = ""
    created_at: str = ""

    def invoice_view(self) -> dict[str, Any]:
        return {
            "id": self.invoice_id,
            "merchant_order_id": self.merchant_order_id,
            "status": self.status,
            "amount_fiat": self.amount_fiat,
            "fiat_currency": self.fiat_currency,
            "amount_crypto": self.amount_crypto,
            "crypto_currency": self.crypto_currency,
            "network": self.network,
            "payment_page_url": self.payment_page_url,
            "payment_address": self.payment_address,
            "payment_memo": self.payment_memo,
            "qr_url": self.qr_url,
            "expires_at": self.expires_at,
            "network_confirmations_actual": None,
            "network_confirmations_required": None,
        }


@dataclass
class OrderBook:
    orders: dict[str, Order] = field(default_factory=dict)
    seen_event_ids: list[str] = field(default_factory=list)
    telegram_offset: int = 0
    _seen: set[str] = field(default_factory=set)
    success_statuses: frozenset[str] = SUCCESS_STATUSES

    def __post_init__(self) -> None:
        self._seen = set(self.seen_event_ids)

    def remember_event(self, event_id: str) -> bool:
        """True, если event_id уже обрабатывался."""
        if not event_id:
            return False
        if event_id in self._seen:
            return True
        self._seen.add(event_id)
        self.seen_event_ids.append(event_id)
        if len(self.seen_event_ids) > 5000:
            dropped = self.seen_event_ids[:-4000]
            self.seen_event_ids = self.seen_event_ids[-4000:]
            self._seen.difference_update(dropped)
        return False

    def upsert_created(self, chat_id: int, invoice: dict[str, Any]) -> Order:
        order = Order(
            merchant_order_id=str(invoice.get("merchant_order_id") or ""),
            invoice_id=str(invoice.get("id") or ""),
            chat_id=chat_id,
            amount_fiat=str(invoice.get("amount_fiat") or ""),
            fiat_currency=str(invoice.get("fiat_currency") or ""),
            crypto_currency=str(invoice.get("crypto_currency") or ""),
            network=str(invoice.get("network") or ""),
            amount_crypto=str(invoice.get("amount_crypto") or ""),
            status=str(invoice.get("status") or "pending"),
            payment_page_url=invoice.get("payment_page_url"),
            payment_address=invoice.get("payment_address"),
            payment_memo=invoice.get("payment_memo"),
            qr_url=invoice.get("qr_url"),
            expires_at=str(invoice.get("expires_at") or "") or None,
            notified_status=str(invoice.get("status") or "pending"),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.orders[order.invoice_id] = order
        return order

    def find(self, query: str) -> Order | None:
        needle = query.strip()
        if not needle:
            return None
        if needle in self.orders:
            return self.orders[needle]
        for order in self.orders.values():
            if order.merchant_order_id == needle:
                return order
        return None

    def latest_for_chat(self, chat_id: int) -> Order | None:
        found = [order for order in self.orders.values() if order.chat_id == chat_id]
        if not found:
            return None
        return max(found, key=lambda order: order.created_at)

    def open_orders(self) -> list[Order]:
        """Счета, за которыми ещё нужно следить. paid опрашивается до confirmed."""
        watched: list[Order] = []
        for order in self.orders.values():
            status = order.status.lower()
            if status in TERMINAL_STATUSES or status == "confirmed":
                continue
            if order.fulfilled and status != "paid":
                continue
            watched.append(order)
        return watched

    def apply_webhook(self, payload: dict[str, Any]) -> list[Outbound]:
        event_id = str(payload.get("event_id") or "")
        if self.remember_event(event_id):
            return []
        event = str(payload.get("event") or "")
        simulated = bool(payload.get("simulated")) or event in SIMULATED_EVENTS
        invoice = payload.get("invoice")
        if not isinstance(invoice, dict):
            return []
        order = self.orders.get(str(invoice.get("id") or ""))
        if order is None:
            merchant_order_id = str(invoice.get("merchant_order_id") or "")
            order = next(
                (item for item in self.orders.values() if item.merchant_order_id == merchant_order_id),
                None,
            )
        if order is None:
            return []
        transaction = payload.get("transaction") if isinstance(payload.get("transaction"), dict) else None
        return self.apply_invoice(order, invoice, simulated=simulated, transaction=transaction)

    def apply_invoice(
        self,
        order: Order,
        invoice: dict[str, Any],
        *,
        simulated: bool,
        transaction: dict[str, Any] | None = None,
    ) -> list[Outbound]:
        self._copy_invoice(order, invoice)
        status = str(invoice.get("status") or order.status or "").lower()
        confirmations = format_confirmations(invoice) or ""

        if simulated:
            view = self._view(order, invoice)
            view["status"] = status
            note = "Тестовая доставка. Статус счёта на платформе не меняется, заказ не закрываю."
            return [
                Outbound(
                    chat_id=order.chat_id,
                    text=invoice_message(view, title="Тестовый вебхук", order_note=note),
                )
            ]

        order.status = status

        if status == order.notified_status and confirmations == order.notified_confirmations:
            return []

        order.notified_status = status
        order.notified_confirmations = confirmations
        view = self._view(order, invoice)
        if status in self.success_statuses:
            order.fulfilled = True
            note = "Оплата принята. Заказ подтверждён."
            if status == "paid":
                note = "Депозит принят (paid). Жду финальное confirmed, если сеть ещё добирает блоки."
            if transaction:
                net = transaction.get("net_amount")
                currency = transaction.get("currency")
                if net is not None:
                    note += f" Зачисление: {net} {currency or ''}."
            title = "Оплата подтверждена" if status == "confirmed" else "Оплата получена"
            return [Outbound(chat_id=order.chat_id, text=invoice_message(view, title=title, order_note=note))]

        if status in TERMINAL_STATUSES:
            return [
                Outbound(
                    chat_id=order.chat_id,
                    text=invoice_message(view, title="Счёт закрыт без оплаты"),
                )
            ]

        title = "Платёж в сети" if status == "confirming" else "Статус счёта"
        return [Outbound(chat_id=order.chat_id, text=invoice_message(view, title=title))]

    @staticmethod
    def _copy_invoice(order: Order, invoice: dict[str, Any]) -> None:
        for attr, key in (
            ("amount_crypto", "amount_crypto"),
            ("crypto_currency", "crypto_currency"),
            ("network", "network"),
            ("payment_page_url", "payment_page_url"),
            ("payment_address", "payment_address"),
            ("payment_memo", "payment_memo"),
            ("qr_url", "qr_url"),
            ("expires_at", "expires_at"),
        ):
            if invoice.get(key) not in (None, ""):
                setattr(order, attr, str(invoice.get(key)))

    @staticmethod
    def _view(order: Order, invoice: dict[str, Any]) -> dict[str, Any]:
        view = order.invoice_view()
        view.update({key: value for key, value in invoice.items() if value is not None})
        view["status"] = order.status
        return view


def load_state(path: Path) -> OrderBook:
    if not path.is_file():
        return OrderBook()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return OrderBook()
    orders: dict[str, Order] = {}
    for invoice_id, item in (raw.get("orders") or {}).items():
        if isinstance(item, dict):
            item.pop("invoice_view", None)
            known = {name: item[name] for name in Order.__dataclass_fields__ if name in item}
            orders[str(invoice_id)] = Order(**known)
    book = OrderBook(
        orders=orders,
        seen_event_ids=list(raw.get("seen_event_ids") or []),
        telegram_offset=int(raw.get("telegram_offset") or 0),
    )
    return book


def save_state(path: Path, book: OrderBook) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "orders": {invoice_id: asdict(order) for invoice_id, order in book.orders.items()},
        "seen_event_ids": book.seen_event_ids[-4000:],
        "telegram_offset": book.telegram_offset,
    }
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


class NorenClient:
    def __init__(self, base: str, public_key: str, secret_key: str, timeout: int = 60) -> None:
        self.base = base.rstrip("/")
        self.public_key = public_key
        self.secret_key = secret_key
        self.timeout = timeout

    def request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        *,
        auth: bool = True,
        bearer: str | None = None,
        timeout: int | None = None,
    ) -> Any:
        url = f"{self.base}{path}"
        headers = {
            "User-Agent": os.environ.get("NOREN_USER_AGENT", _DEFAULT_UA).strip() or _DEFAULT_UA,
            "Accept": "application/json, text/plain, */*",
        }
        if auth:
            headers["X-API-Key"] = self.public_key
            headers["X-API-Secret"] = self.secret_key
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        req = Request(url, data=data, method=method, headers=headers)
        try:
            with urlopen(req, timeout=timeout or self.timeout) as resp:
                raw = resp.read().decode("utf-8") or "{}"
                return json.loads(raw)
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"network error: {exc.reason}") from exc

    def health(self) -> dict[str, Any]:
        return self.request("GET", "/api/v1/client/health", auth=False)

    def rates(self) -> dict[str, Any]:
        return self.request("GET", "/api/v1/client/rates")

    def balance(self) -> dict[str, Any]:
        return self.request("GET", "/api/v1/client/balance")

    def create_invoice(self, body: dict[str, Any]) -> dict[str, Any]:
        return self.request("POST", "/api/v1/client/invoices", body)

    def get_invoice(self, invoice_id: str) -> dict[str, Any]:
        return self.request("GET", f"/api/v1/client/invoices/{invoice_id}")

    def sync_invoice(self, invoice_id: str) -> dict[str, Any]:
        return self.request("POST", f"/api/v1/client/invoices/{invoice_id}/sync")

    def public_payment(self, token: str) -> dict[str, Any]:
        return self.request("GET", f"/api/v1/public/pay/{token}", auth=False)

    def login(self, email: str, password: str, otp: str) -> str:
        body: dict[str, Any] = {"email": email, "password": password}
        if otp:
            body["otp_code"] = otp
        payload = self.request("POST", "/api/v1/client/auth/login", body, auth=False)
        token = str(payload.get("access_token") or "")
        if not token:
            raise RuntimeError("Логин не вернул access_token.")
        return token

    def save_webhook(self, bearer: str, project_id: str, webhook_url: str, webhook_secret: str) -> dict[str, Any]:
        return self.request(
            "POST",
            "/api/v1/client/webhooks",
            {
                "project_id": project_id,
                "webhook_url": webhook_url,
                "webhook_secret": webhook_secret,
            },
            auth=False,
            bearer=bearer,
        )

    def resolve_project_id(self, configured: str) -> str:
        if configured:
            return configured
        invoices = self.request("GET", "/api/v1/client/invoices?limit=1")
        if isinstance(invoices, list) and invoices:
            project_id = str(invoices[0].get("project_id") or "")
            if project_id:
                return project_id
        raise RuntimeError("Укажите NOREN_PROJECT_ID — по ключу проект не определился.")


class TelegramApi:
    def __init__(self, token: str) -> None:
        self.token = token

    def call(self, method: str, payload: dict[str, Any] | None = None, timeout: int = 40) -> dict[str, Any]:
        url = f"https://api.telegram.org/bot{self.token}/{method}"
        data = json.dumps(payload or {}).encode("utf-8")
        req = Request(
            url,
            data=data,
            method="POST",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urlopen(req, timeout=timeout) as resp:
                parsed = json.loads(resp.read().decode("utf-8") or "{}")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Telegram HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"Telegram network error: {exc.reason}") from exc
        if not parsed.get("ok", False):
            raise RuntimeError(f"Telegram API: {parsed.get('description') or parsed}")
        return parsed

    def send(self, chat_id: int, text: str, reply_markup: dict[str, Any] | None = None) -> None:
        body: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text[:4000],
            "parse_mode": "HTML",
            "disable_web_page_preview": False,
        }
        if reply_markup:
            body["reply_markup"] = reply_markup
        self.call("sendMessage", body, timeout=20)

    def set_commands(self) -> None:
        self.call(
            "setMyCommands",
            {
                "commands": [
                    {"command": "pay", "description": "Счёт на оплату: /pay 10"},
                    {"command": "status", "description": "Статус последнего платежа"},
                    {"command": "balance", "description": "Баланс мерчанта"},
                    {"command": "rates", "description": "Доступные токены и сети"},
                    {"command": "help", "description": "Как проходит оплата"},
                ]
            },
            timeout=20,
        )


def make_webhook_handler(
    book: OrderBook,
    secret: str,
    lock: threading.Lock,
    on_messages: Callable[[list[Outbound]], None],
    on_persist: Callable[[], None],
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path in {"/health", "/"}:
                self._json(200, {"status": "ok"})
                return
            self._json(404, {"detail": "not found"})

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path not in WEBHOOK_PATHS:
                self._json(404, {"detail": "not found"})
                return
            length = int(self.headers.get("Content-Length") or "0")
            if length < 0 or length > MAX_WEBHOOK_BODY:
                self._json(413, {"detail": "body too large"})
                return
            raw = self.rfile.read(length)
            signature = self.headers.get("X-Merset-Signature")
            if not verify_signature(secret, raw, signature):
                log("Вебхук отклонён: подпись X-Merset-Signature не сошлась.")
                self._json(401, {"detail": "invalid signature"})
                return
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                self._json(400, {"detail": "body must be json"})
                return
            if not isinstance(payload, dict):
                self._json(400, {"detail": "body must be an object"})
                return
            event_id = str(payload.get("event_id") or self.headers.get("X-Merset-Event-Id") or "")
            if event_id and not payload.get("event_id"):
                payload["event_id"] = event_id
            try:
                with lock:
                    messages = book.apply_webhook(payload)
                    on_persist()
            except Exception as exc:
                log(f"Не удалось записать вебхук {event_id}: {exc}")
                self._json(500, {"detail": "failed to record event"})
                return
            event = payload.get("event")
            invoice = payload.get("invoice") if isinstance(payload.get("invoice"), dict) else {}
            log(
                f"Вебхук {event or '-'} event_id={event_id or '-'} "
                f"invoice={invoice.get('id') or '-'} status={invoice.get('status') or '-'}"
            )
            if messages:
                try:
                    on_messages(messages)
                except Exception as exc:
                    log(f"Вебхук записан, но уведомление не ушло: {exc}")
            self._json(200, {"received": True, "event_id": event_id})

        def log_message(self, fmt: str, *args: Any) -> None:
            return

        def _json(self, code: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def rates_text(rates: dict[str, Any]) -> str:
    lines = ["<b>Доступные сети</b>"]
    found = False
    for item in rates.get("items") or []:
        currency = item.get("currency")
        for net in item.get("networks") or []:
            if not net.get("client_available") or not net.get("acquiring"):
                continue
            found = True
            lines.append(
                f"{_esc(currency)}/{_esc(net.get('network'))} "
                f"min {_esc(net.get('min_deposit_fiat') or net.get('min_deposit'))} "
                f"max {_esc(net.get('max_deposit_fiat') or net.get('max_deposit'))}"
            )
    if not found:
        lines.append("Сейчас нет сетей с acquiring.")
    return "\n".join(lines)


def balance_text(balance: dict[str, Any]) -> str:
    return "\n".join(
        [
            "<b>Баланс</b>",
            f"Валюта: {_esc(balance.get('currency'))}",
            f"Доступно: {_esc(balance.get('available_amount'))}",
            f"В холде: {_esc(balance.get('frozen_amount'))}",
            f"Всего: {_esc(balance.get('total_amount'))}",
        ]
    )


HELP_TEXT = """<b>Приём оплаты Noren</b>
/pay 10 — счёт на 10 USD в сети по умолчанию
/pay 25 USDT TRC20 — сумма и маршрут
/status — последний счёт в этом чате
/status &lt;id&gt; — сверить конкретный счёт
/balance — баланс мерчанта
/rates — сети и лимиты

После оплаты бот ловит вебхук <code>invoice.paid</code> / <code>invoice.confirmed</code>, проверяет подпись и пишет, что заказ подтверждён. Пока вебхук не дошёл, статус обновляется опросом API."""


class PayBot:
    def __init__(
        self,
        *,
        noren: NorenClient,
        telegram: TelegramApi,
        book: OrderBook,
        state_path: Path,
        project_id: str,
        fiat_currency: str,
        default_amount: str,
        default_crypto: str,
        default_network: str,
        poll_interval: int,
        allowed_user_ids: set[int],
        webhook_secret: str,
        webhook_host: str,
        webhook_port: int,
        webhook_public_url: str,
        merchant_email: str,
        merchant_password: str,
        merchant_otp: str,
    ) -> None:
        self.noren = noren
        self.telegram = telegram
        self.book = book
        self.state_path = state_path
        self.project_id = project_id
        self.fiat_currency = fiat_currency
        self.default_amount = default_amount
        self.default_crypto = default_crypto
        self.default_network = default_network
        self.poll_interval = poll_interval
        self.allowed_user_ids = allowed_user_ids
        self.webhook_secret = webhook_secret
        self.webhook_host = webhook_host
        self.webhook_port = webhook_port
        self.webhook_public_url = webhook_public_url
        self.merchant_email = merchant_email
        self.merchant_password = merchant_password
        self.merchant_otp = merchant_otp
        self.lock = threading.Lock()
        self._stop = threading.Event()

    def persist(self) -> None:
        save_state(self.state_path, self.book)

    def deliver(self, messages: list[Outbound]) -> None:
        for message in messages:
            try:
                self.telegram.send(message.chat_id, message.text, message.reply_markup)
            except Exception as exc:
                log(f"Не отправил сообщение в {message.chat_id}: {exc}")

    def configure_webhook(self) -> None:
        target = webhook_target(self.webhook_public_url)
        dns_problem = describe_webhook_dns(target)
        if dns_problem:
            log(dns_problem)
        log(f"Webhook URL для кабинета Noren: {target}")
        if not self.merchant_email or not self.merchant_password:
            log(f"Сохраните в кабинете Noren webhook URL: {target}")
            log("Секрет должен совпадать с NOREN_WEBHOOK_SECRET.")
            return
        try:
            token = self.noren.login(self.merchant_email, self.merchant_password, self.merchant_otp)
            saved = self.noren.save_webhook(token, self.project_id, target, self.webhook_secret)
            log(f"Webhook сохранён: {saved.get('webhook_url') or target}")
        except Exception as exc:
            log(f"Не удалось записать webhook через API: {short_api_error(exc)}")
            log(f"Укажите вручную: {target}")

    def serve_webhooks(self) -> None:
        handler = make_webhook_handler(
            self.book,
            self.webhook_secret,
            self.lock,
            self.deliver,
            self.persist,
        )
        server = ThreadingHTTPServer((self.webhook_host, self.webhook_port), handler)
        log(f"Вебхук слушает http://{self.webhook_host}:{self.webhook_port}/webhooks/noren")
        server.serve_forever()

    def poll_invoices(self) -> None:
        while not self._stop.wait(self.poll_interval):
            with self.lock:
                open_orders = list(self.book.open_orders())
            for order in open_orders:
                try:
                    snapshot = self._refresh_invoice(order.invoice_id)
                except Exception as exc:
                    log(f"Опрос {order.invoice_id}: {short_api_error(exc)}")
                    continue
                with self.lock:
                    current = self.book.orders.get(order.invoice_id)
                    if current is None:
                        continue
                    messages = self.book.apply_invoice(current, snapshot, simulated=False)
                    self.persist()
                self.deliver(messages)

    def _refresh_invoice(self, invoice_id: str) -> dict[str, Any]:
        try:
            return self.noren.sync_invoice(invoice_id)
        except Exception:
            return self.noren.get_invoice(invoice_id)

    def allowed(self, user_id: int | None) -> bool:
        if not self.allowed_user_ids:
            return True
        return user_id in self.allowed_user_ids

    def handle_update(self, update: dict[str, Any]) -> None:
        message = update.get("message") or update.get("edited_message") or {}
        chat = message.get("chat") or {}
        user = message.get("from") or {}
        chat_id = chat.get("id")
        text = str(message.get("text") or "")
        if chat_id is None or not text:
            return
        if not self.allowed(user.get("id")):
            self.telegram.send(int(chat_id), "Этот бот принимает платежи только для указанных пользователей.")
            return
        command, rest = parse_command(text)
        if command in {"start", "help"}:
            self.telegram.send(int(chat_id), HELP_TEXT)
            return
        if command == "pay":
            self.command_pay(int(chat_id), rest)
            return
        if command == "status":
            self.command_status(int(chat_id), rest)
            return
        if command == "balance":
            self.command_balance(int(chat_id))
            return
        if command == "rates":
            self.command_rates(int(chat_id))
            return
        if command:
            self.telegram.send(int(chat_id), "Неизвестная команда. /help")

    def command_rates(self, chat_id: int) -> None:
        try:
            rates = self.noren.rates()
        except Exception as exc:
            self.telegram.send(chat_id, f"Не получил /rates: {_esc(short_api_error(exc))}")
            return
        self.telegram.send(chat_id, rates_text(rates))

    def command_balance(self, chat_id: int) -> None:
        try:
            balance = self.noren.balance()
        except Exception as exc:
            self.telegram.send(chat_id, f"Не получил /balance: {_esc(short_api_error(exc))}")
            return
        self.telegram.send(chat_id, balance_text(balance))

    def command_pay(self, chat_id: int, rest: str) -> None:
        try:
            amount_raw, crypto, network = parse_pay_args(
                rest,
                default_amount=self.default_amount,
                default_crypto=self.default_crypto,
                default_network=self.default_network,
            )
            amount = parse_amount(amount_raw)
        except ValueError as exc:
            self.telegram.send(chat_id, _esc(exc))
            return
        try:
            rates = self.noren.rates()
            crypto, network = pick_route(rates, crypto, network)
        except Exception as exc:
            self.telegram.send(chat_id, f"Не выбрал сеть: {_esc(short_api_error(exc))}")
            return
        order_id = f"tg-{uuid.uuid4().hex[:12]}"
        body = {
            "project_id": self.project_id,
            "merchant_order_id": order_id,
            "amount_fiat": format(amount, "f"),
            "fiat_currency": self.fiat_currency,
            "crypto_currency": crypto,
            "network": network,
            "metadata": {"source": "examples/noren_telegram_pay_bot.py", "chat_id": chat_id},
        }
        try:
            invoice = self.noren.create_invoice(body)
        except Exception as exc:
            self.telegram.send(chat_id, f"Не создал счёт: {_esc(short_api_error(exc))}")
            return
        with self.lock:
            order = self.book.upsert_created(chat_id, invoice)
            self.persist()
        log(f"Счёт {order.invoice_id} для chat {chat_id} order {order.merchant_order_id}")
        self.telegram.send(
            chat_id,
            invoice_message(invoice, title="Счёт создан", order_note="Оплатите по ссылке. Я напишу, когда Noren подтвердит перевод."),
            payment_keyboard(invoice),
        )

    def command_status(self, chat_id: int, rest: str) -> None:
        with self.lock:
            order = self.book.find(rest) if rest else self.book.latest_for_chat(chat_id)
        if order is None or order.chat_id != chat_id:
            self.telegram.send(chat_id, "В этом чате ещё нет счетов. Создайте: /pay 10")
            return
        try:
            snapshot = self._refresh_invoice(order.invoice_id)
        except Exception as exc:
            self.telegram.send(chat_id, f"Не сверил статус: {_esc(short_api_error(exc))}")
            return
        token = payment_token(str(snapshot.get("payment_page_url") or order.payment_page_url or ""))
        if token:
            try:
                public = self.noren.public_payment(token)
                if public.get("status"):
                    snapshot = {**snapshot, "status": public.get("status")}
                    for key in (
                        "network_confirmations_actual",
                        "network_confirmations_required",
                        "payment_address",
                        "qr_url",
                    ):
                        if public.get(key) is not None:
                            snapshot[key] = public.get(key)
            except Exception as exc:
                log(f"Публичная страница {order.invoice_id}: {short_api_error(exc)}")
        with self.lock:
            current = self.book.orders.get(order.invoice_id) or order
            messages = self.book.apply_invoice(current, snapshot, simulated=False)
            self.persist()
            view = current.invoice_view()
            view.update({key: value for key, value in snapshot.items() if value is not None})
        if not messages:
            self.telegram.send(chat_id, invoice_message(view, title="Текущий статус"), payment_keyboard(view))
            return
        for message in messages:
            message.reply_markup = payment_keyboard(view)
        self.deliver(messages)

    def run(self) -> None:
        health = self.noren.health()
        log(f"Noren health: {json.dumps(health, ensure_ascii=False)}")
        self.project_id = self.noren.resolve_project_id(self.project_id)
        log(f"Проект: {self.project_id}")
        if not self.webhook_secret:
            log("NOREN_WEBHOOK_SECRET пуст — подпись вебхука не проверяется.")
        self.configure_webhook()
        threading.Thread(target=self.serve_webhooks, name="noren-webhook", daemon=True).start()
        threading.Thread(target=self.poll_invoices, name="noren-poll", daemon=True).start()
        try:
            self.telegram.set_commands()
        except Exception as exc:
            log(f"Не записал меню команд: {exc}")
        log("Жду сообщения Telegram. Остановка: Ctrl+C.")
        while not self._stop.is_set():
            try:
                payload = self.telegram.call(
                    "getUpdates",
                    {
                        "offset": self.book.telegram_offset,
                        "timeout": 25,
                        "allowed_updates": ["message"],
                    },
                    timeout=40,
                )
            except Exception as exc:
                log(f"getUpdates: {exc}")
                time.sleep(3)
                continue
            updates = payload.get("result") or []
            for update in updates:
                update_id = int(update.get("update_id") or 0)
                try:
                    self.handle_update(update)
                except Exception as exc:
                    log(f"Ошибка обработки update {update_id}: {exc}")
                with self.lock:
                    self.book.telegram_offset = update_id + 1
                    self.persist()


def build_from_env() -> PayBot:
    script_dir = Path(__file__).resolve().parent
    load_env_file(script_dir / ".env")
    load_env_file(Path.cwd() / ".env")

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    base = os.environ.get("NOREN_API_BASE", "").strip().rstrip("/")
    public = os.environ.get("NOREN_PUBLIC_KEY", "").strip()
    secret = os.environ.get("NOREN_SECRET_KEY", "").strip()
    missing = [
        name
        for name, value in (
            ("TELEGRAM_BOT_TOKEN", token),
            ("NOREN_API_BASE", base),
            ("NOREN_PUBLIC_KEY", public),
            ("NOREN_SECRET_KEY", secret),
        )
        if not value
    ]
    if missing:
        raise SystemExit("Задайте переменные: " + ", ".join(missing))

    allowed_raw = os.environ.get("TELEGRAM_ALLOWED_USER_IDS", "")
    allowed = {int(part) for part in allowed_raw.split(",") if part.strip().isdigit() or _signed_int(part)}
    state_path = Path(
        os.environ.get("NOREN_BOT_STATE", str(script_dir / ".noren-telegram-bot-state.json"))
    ).expanduser()
    success = os.environ.get("NOREN_SUCCESS_STATUSES", "").strip()
    book = load_state(state_path)
    if success:
        book.success_statuses = frozenset(part.strip().lower() for part in success.split(",") if part.strip())

    return PayBot(
        noren=NorenClient(base, public, secret),
        telegram=TelegramApi(token),
        book=book,
        state_path=state_path,
        project_id=os.environ.get("NOREN_PROJECT_ID", "").strip(),
        fiat_currency=os.environ.get("NOREN_FIAT_CURRENCY", "USD").strip().upper() or "USD",
        default_amount=os.environ.get("NOREN_DEFAULT_AMOUNT", "10").strip() or "10",
        default_crypto=os.environ.get("NOREN_CRYPTO_CURRENCY", "").strip(),
        default_network=os.environ.get("NOREN_NETWORK", "").strip(),
        poll_interval=max(5, _env_int("NOREN_POLL_INTERVAL", 15)),
        allowed_user_ids=allowed,
        webhook_secret=os.environ.get("NOREN_WEBHOOK_SECRET", "").strip(),
        webhook_host=os.environ.get("NOREN_WEBHOOK_HOST", "0.0.0.0").strip() or "0.0.0.0",
        webhook_port=_env_int("NOREN_WEBHOOK_PORT", 8787),
        webhook_public_url=os.environ.get("NOREN_WEBHOOK_PUBLIC_URL", "").strip() or DEFAULT_WEBHOOK_ORIGIN,
        merchant_email=os.environ.get("NOREN_MERCHANT_EMAIL", "").strip(),
        merchant_password=os.environ.get("NOREN_MERCHANT_PASSWORD", "").strip(),
        merchant_otp=os.environ.get("NOREN_MERCHANT_OTP", "").strip(),
    )


def _signed_int(raw: str) -> bool:
    text = raw.strip()
    if text.startswith("-"):
        text = text[1:]
    return text.isdigit()


def _load_local_env() -> None:
    script_dir = Path(__file__).resolve().parent
    load_env_file(script_dir / ".env")
    load_env_file(Path.cwd() / ".env")


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def run_webhook_only() -> int:
    """HTTP-приёмник без Telegram и ключей Noren. Нужен, чтобы домен уже отвечал на вебхук."""
    script_dir = Path(__file__).resolve().parent
    state_path = Path(
        os.environ.get("NOREN_BOT_STATE", str(script_dir / ".noren-telegram-bot-state.json"))
    ).expanduser()
    book = load_state(state_path)
    lock = threading.Lock()
    host = os.environ.get("NOREN_WEBHOOK_HOST", "127.0.0.1").strip() or "127.0.0.1"
    port = _env_int("NOREN_WEBHOOK_PORT", 8787)
    secret = os.environ.get("NOREN_WEBHOOK_SECRET", "").strip()
    target = webhook_target(os.environ.get("NOREN_WEBHOOK_PUBLIC_URL", ""))

    def persist() -> None:
        save_state(state_path, book)

    def on_messages(messages: list[Outbound]) -> None:
        for message in messages:
            log(f"уведомление для chat {message.chat_id} сохранено, Telegram в этом режиме не отправляется")

    handler = make_webhook_handler(book, secret, lock, on_messages, persist)
    dns_problem = describe_webhook_dns(target)
    if dns_problem:
        log(dns_problem)
    if not secret:
        log("NOREN_WEBHOOK_SECRET пуст — подпись не проверяется.")
    log(f"Режим приёма вебхуков: http://{host}:{port}/webhooks/noren")
    log(f"Публичный URL: {target}")
    server = ThreadingHTTPServer((host, port), handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Остановлено.")
        persist()
        return 130
    return 0


def main() -> int:
    _load_local_env()
    if _env_flag("NOREN_WEBHOOK_ONLY"):
        return run_webhook_only()
    bot = build_from_env()
    try:
        bot.run()
    except KeyboardInterrupt:
        log("Остановлено.")
        bot.persist()
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
