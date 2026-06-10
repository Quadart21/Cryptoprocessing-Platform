"""
Crypto-Cash transaction statuses and acquiring webhook events.

Reference: https://docs.crypto-cash.world/webhooks/structure
Events:     https://docs.crypto-cash.world/webhooks/types
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Sale statuses where Crypto-Cash credited USDT to merchant balance (data.status).
# See https://docs.crypto-cash.world/webhooks/structure#значения-статусов
CRYPTO_CASH_DEPOSIT_CREDITED_STATUSES = frozenset(
    {
        "paid",
        "overpaid",
        "underpaid",
        "canceledbutpaid",
        "canceledbutoverpaid",
        "canceledbutunderpaid",
        "confirmed",
        "completed",
        "deposit_received",
    }
)

# Terminal acquiring events that follow deposit_received (credit + email).
# See https://docs.crypto-cash.world/webhooks/types
ACQUIRING_FINAL_CREDIT_EVENTS = frozenset(
    {
        "acquiring::completed",
        "acquiring::overpaid",
        "acquiring::underpaid",
    }
)

# Sale (пополнение / acquiring) — значения поля data.status
CRYPTO_CASH_STATUS_TO_PLATFORM: dict[str, str] = {
    # Ожидание депозита
    "queued": "pending",
    "new": "pending",
    # Подтверждение в блокчейне
    "waiting": "confirming",
    # Успешные / частичные депозиты (все зачисляют USDT на баланс CC)
    "paid": "paid",
    "overpaid": "paid",
    "underpaid": "paid",
    # Отмена / ошибки
    "canceled": "cancelled",
    "cancelled": "cancelled",
    "currencymismatch": "failed",
    # Просроченный заказ (>24ч), но депозит всё же пришёл — зачисление сохраняется
    "canceledbutpaid": "paid",
    "canceledbutoverpaid": "paid",
    "canceledbutunderpaid": "paid",
    # Legacy / internal aliases
    "pending": "pending",
    "confirming": "confirming",
    "confirmed": "confirmed",
    "expired": "expired",
    "failed": "failed",
    "declined": "failed",
    "completed": "confirmed",
    "deposit_received": "paid",
}

# acquiring::* → data.status по умолчанию, если status отсутствует в payload
ACQUIRING_EVENT_DEFAULT_STATUS: dict[str, str] = {
    "acquiring::created": "New",
    "acquiring::confirmation_started": "Waiting",
    "acquiring::confirmation": "Waiting",
    # deposit_received приходит в паре с completed/overpaid/underpaid/currency_mismatch
    "acquiring::deposit_received": "Paid",
    "acquiring::completed": "Paid",
    "acquiring::overpaid": "Overpaid",
    "acquiring::underpaid": "Underpaid",
    "acquiring::currency_mismatch": "CurrencyMismatch",
    "acquiring::declined": "Canceled",
    "acquiring::canceled": "Canceled",
}


def normalize_provider_status_key(provider_status: str | None) -> str:
    if not provider_status:
        return ""
    return str(provider_status).strip().lower()


def provider_status_indicates_deposit_credit(provider_status: str | None) -> bool:
    return normalize_provider_status_key(provider_status) in CRYPTO_CASH_DEPOSIT_CREDITED_STATUSES


def acquiring_event_finalizes_credit(event_type: str | None) -> bool:
    if not event_type:
        return False
    return str(event_type).strip().lower() in ACQUIRING_FINAL_CREDIT_EVENTS

PLATFORM_PAYMENT_IN_FLIGHT = frozenset({"confirming", "paid", "confirmed"})


def normalize_crypto_cash_status(provider_status: str) -> str:
    """Map Crypto-Cash TransactionStatus (PascalCase or lower) to platform invoice status."""
    normalized = provider_status.strip().lower()
    mapped = CRYPTO_CASH_STATUS_TO_PLATFORM.get(normalized)
    if mapped is not None:
        return mapped
    logger.warning("Unknown Crypto-Cash status %r — treating as pending", provider_status)
    return "pending"


def resolve_crypto_cash_status(
    *,
    status: str | None,
    event_type: str | None = None,
) -> str:
    """Resolve status from data.status and/or acquiring:: event type."""
    if status and str(status).strip():
        return normalize_crypto_cash_status(str(status))
    if event_type:
        key = str(event_type).strip().lower()
        default_status = ACQUIRING_EVENT_DEFAULT_STATUS.get(key)
        if default_status:
            return normalize_crypto_cash_status(default_status)
    raise ValueError("Crypto-Cash webhook payload has no status or known event type.")


def platform_status_indicates_payment(platform_status: str) -> bool:
    return platform_status in PLATFORM_PAYMENT_IN_FLIGHT


def extract_event_type(raw_payload: dict | None) -> str | None:
    if not isinstance(raw_payload, dict):
        return None
    event = raw_payload.get("event")
    if not isinstance(event, dict):
        return None
    for key in ("type", "event_type", "eventType"):
        value = event.get(key)
        if value not in (None, ""):
            return str(value)
    return None


def extract_event_data(raw_payload: dict | None) -> dict:
    if not isinstance(raw_payload, dict):
        return {}
    event = raw_payload.get("event")
    if isinstance(event, dict):
        data = event.get("data")
        if isinstance(data, dict):
            return data
    data = raw_payload.get("data")
    if isinstance(data, dict):
        item = data.get("item")
        if isinstance(item, dict):
            return item
        return data
    return {}


def extract_tx_hash(raw_payload: dict | None) -> str | None:
    data = extract_event_data(raw_payload)
    value = data.get("hash")
    if value in (None, ""):
        return None
    return str(value)
