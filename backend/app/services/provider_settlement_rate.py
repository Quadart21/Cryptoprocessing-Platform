from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from app.providers.crypto_cash_status import CRYPTO_CASH_DEPOSIT_CREDITED_STATUSES

STORED_SETTLEMENT_RATE_KEY = "settlement_exchange_rate"
SETTLEMENT_USDT_PRECISION = Decimal("0.0001")
AMOUNT_PRECISION = Decimal("0.00000001")
RATE_KEYS = ("exchangeRate", "exchange_rate", "rate", "conversionRate")
AMOUNT_KEYS = ("amount", "receivedAmount", "expectedAmount", "requestedAmount")
PAID_LIKE_PROVIDER_STATUSES = CRYPTO_CASH_DEPOSIT_CREDITED_STATUSES


def _parse_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        parsed = Decimal(str(value).replace(",", "."))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _payload_data_candidates(raw_payload: dict | None) -> list[dict]:
    if not isinstance(raw_payload, dict):
        return []

    candidates: list[dict] = []
    event = raw_payload.get("event")
    if isinstance(event, dict):
        data = event.get("data")
        if isinstance(data, dict):
            candidates.append(data)

    data = raw_payload.get("data")
    if isinstance(data, dict):
        item = data.get("item")
        if isinstance(item, dict):
            candidates.append(item)
        if "exchangeRate" in data or "exchange_rate" in data:
            candidates.append(data)

    return candidates


def _provider_status_from_payload(raw_payload: dict | None) -> str | None:
    for candidate in _payload_data_candidates(raw_payload):
        status = candidate.get("status")
        if status not in (None, ""):
            return str(status).strip().lower()
    return None


def extract_settlement_fields_from_payload(
    raw_payload: dict | None,
) -> tuple[Decimal | None, Decimal | None]:
    """Return (exchange_rate USDT per 1 crypto unit, crypto amount) from CC payload."""
    rate: Decimal | None = None
    amount: Decimal | None = None
    for candidate in _payload_data_candidates(raw_payload):
        if rate is None:
            for key in RATE_KEYS:
                rate = _parse_decimal(candidate.get(key))
                if rate is not None:
                    break
        if amount is None:
            for key in AMOUNT_KEYS:
                amount = _parse_decimal(candidate.get(key))
                if amount is not None:
                    break
        if rate is not None and amount is not None:
            break
    return rate, amount


def extract_settlement_rate_from_stored(stored_payload: dict | None) -> Decimal | None:
    if not isinstance(stored_payload, dict):
        return None

    direct = _parse_decimal(stored_payload.get(STORED_SETTLEMENT_RATE_KEY))
    if direct is not None:
        return direct

    for key in ("last_webhook_payload", "retrieve_response"):
        payload = stored_payload.get(key)
        if not isinstance(payload, dict):
            continue
        status = _provider_status_from_payload(payload)
        if status is not None and status not in PAID_LIKE_PROVIDER_STATUSES:
            continue
        rate, _ = extract_settlement_fields_from_payload(payload)
        if rate is not None:
            return rate

    for payload in (stored_payload.get("last_webhook_payload"), stored_payload.get("retrieve_response")):
        if not isinstance(payload, dict):
            continue
        rate, _ = extract_settlement_fields_from_payload(payload)
        if rate is not None:
            return rate

    return None


def apply_settlement_fields_to_stored(
    stored_payload: dict,
    raw_payload: dict | None,
    *,
    provider_status: str | None = None,
) -> bool:
    """Persist CC exchangeRate from Paid-like webhook/retrieve into invoice payload."""
    if not isinstance(raw_payload, dict):
        return False

    normalized = (provider_status or _provider_status_from_payload(raw_payload) or "").strip().lower()
    rate, amount = extract_settlement_fields_from_payload(raw_payload)
    changed = False

    if rate is not None and normalized in PAID_LIKE_PROVIDER_STATUSES:
        if stored_payload.get(STORED_SETTLEMENT_RATE_KEY) != str(rate.normalize()):
            stored_payload[STORED_SETTLEMENT_RATE_KEY] = format(rate.normalize(), "f")
            changed = True

    if amount is not None and normalized in PAID_LIKE_PROVIDER_STATUSES:
        current = stored_payload.get("settlement_amount_crypto")
        formatted = format(amount.normalize(), "f")
        if current != formatted:
            stored_payload["settlement_amount_crypto"] = formatted
            changed = True

    return changed


def resolve_settlement_amount_crypto(invoice_amount_crypto: Decimal, stored_payload: dict | None) -> Decimal:
    if isinstance(stored_payload, dict):
        stored_amount = _parse_decimal(stored_payload.get("settlement_amount_crypto"))
        if stored_amount is not None:
            return stored_amount.quantize(AMOUNT_PRECISION)
    return Decimal(invoice_amount_crypto).quantize(AMOUNT_PRECISION)


def gross_from_provider_rate(
    *,
    amount_crypto: Decimal,
    exchange_rate: Decimal,
) -> Decimal:
    return (amount_crypto * exchange_rate).quantize(SETTLEMENT_USDT_PRECISION)
