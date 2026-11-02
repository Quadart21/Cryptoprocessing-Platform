"""Track underpaid / overpaid deposits and settle them for the amount that arrived."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from app.providers.crypto_cash_status import extract_event_data, extract_event_type, normalize_provider_status_key

STORED_AMOUNT_REVIEW_KEY = "amount_review"
AMOUNT_REVIEW_PLATFORM_STATUSES = frozenset({"underpaid", "overpaid"})


def parse_amount(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        parsed = Decimal(str(value).replace(" ", "").replace(",", "."))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not parsed.is_finite():
        return None
    return parsed


def format_crypto_amount(value: Decimal) -> str:
    sign = "-" if value < 0 else ""
    text = format(abs(value), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return f"{sign}{text or '0'}"


def review_kind(provider_status: str | None, event_type: str | None = None) -> str | None:
    key = normalize_provider_status_key(provider_status)
    if key in {"underpaid", "canceledbutunderpaid"}:
        return "underpaid"
    if key in {"overpaid", "canceledbutoverpaid"}:
        return "overpaid"
    event = (event_type or "").strip().lower()
    if event == "acquiring::underpaid":
        return "underpaid"
    if event == "acquiring::overpaid":
        return "overpaid"
    return None


def read_amount_review(stored_payload: dict | None) -> dict | None:
    if not isinstance(stored_payload, dict):
        return None
    review = stored_payload.get(STORED_AMOUNT_REVIEW_KEY)
    if not isinstance(review, dict):
        return None
    kind = review.get("kind")
    if kind not in AMOUNT_REVIEW_PLATFORM_STATUSES:
        return None
    return review


def should_keep_credited_invoice(previous_status: str, raw_normalized: str) -> bool:
    """A later mismatch webhook must not undo a payment that was already settled."""
    return previous_status == "confirmed" and raw_normalized in AMOUNT_REVIEW_PLATFORM_STATUSES


def review_needs_alert(
    previous_status: str,
    old_review: dict | None,
    new_review: dict | None,
) -> bool:
    if new_review is None or new_review.get("credited"):
        return False
    if previous_status not in AMOUNT_REVIEW_PLATFORM_STATUSES:
        return True
    if old_review is None:
        return True
    return (
        old_review.get("received_amount") != new_review.get("received_amount")
        or old_review.get("kind") != new_review.get("kind")
    )


def amount_review_public_dict(stored_payload: dict | None) -> dict | None:
    review = read_amount_review(stored_payload)
    if review is None:
        return None
    return {
        "kind": review.get("kind"),
        "provider_status": review.get("provider_status"),
        "expected_amount": review.get("expected_amount"),
        "received_amount": review.get("received_amount"),
        "delta_amount": review.get("delta_amount"),
        "currency": review.get("currency"),
        "usdt_total": review.get("usdt_total"),
        "exchange_rate": review.get("exchange_rate"),
        "credited": bool(review.get("credited")),
    }


def upsert_amount_review(
    stored_payload: dict,
    raw_payload: dict | None,
    *,
    provider_status: str | None,
    event_type: str | None = None,
) -> bool:
    current = read_amount_review(stored_payload)
    incoming = (
        build_amount_review(raw_payload, provider_status=provider_status, event_type=event_type)
        if isinstance(raw_payload, dict)
        else None
    )
    if incoming is None:
        if current is None or current.get("credited") or not isinstance(raw_payload, dict):
            return False
        incoming = _refresh_open_review(current, raw_payload)
        if incoming is None:
            return False
    else:
        incoming["credited"] = bool(current and current.get("credited"))
    if current == incoming:
        return False
    stored_payload[STORED_AMOUNT_REVIEW_KEY] = incoming
    return True


def pin_received_settlement(stored_payload: dict) -> bool:
    """Settlement gross must use the crypto that actually arrived, not the quote."""
    review = read_amount_review(stored_payload)
    if review is None:
        return False
    received = parse_amount(review.get("received_amount"))
    if received is None or received <= 0:
        return False
    stored_payload["settlement_amount_crypto"] = format_crypto_amount(received)
    rate = parse_amount(review.get("exchange_rate"))
    if rate is not None and rate > 0:
        stored_payload["settlement_exchange_rate"] = format_crypto_amount(rate)
    updated = dict(review)
    updated["credited"] = True
    stored_payload[STORED_AMOUNT_REVIEW_KEY] = updated
    return True


def build_amount_review_notice(
    *,
    merchant_name: str,
    invoice_id: str,
    review: dict,
) -> tuple[str, list[str]]:
    kind = review.get("kind")
    title = (
        "Недоплата — зачислили фактическую сумму"
        if kind == "underpaid"
        else "Переплата — зачислили фактическую сумму"
    )
    currency = str(review.get("currency") or "").strip()
    suffix = f" {currency}" if currency else ""
    lines = [
        f"Мерчант: {merchant_name}",
        f"Ожидали: {_amount_line(review.get('expected_amount'), suffix)}",
        f"Пришло: {_amount_line(review.get('received_amount'), suffix)}",
        f"Разница: {_amount_line(review.get('delta_amount'), suffix)}",
    ]
    usdt_total = review.get("usdt_total")
    if usdt_total not in (None, ""):
        lines.append(f"USDT у провайдера: {_amount_line(usdt_total, ' USDT')}")
    if review.get("received_amount"):
        lines.append("Платформа зачисляет пришедшую сумму автоматически.")
    else:
        lines.append("В вебхуке нет фактической суммы, зачисление ждёт её.")
    lines.append(f"Invoice ID: {invoice_id}")
    return title, lines


def build_amount_review(
    raw_payload: dict | None,
    *,
    provider_status: str | None,
    event_type: str | None = None,
) -> dict | None:
    if not isinstance(raw_payload, dict):
        return None
    resolved_event = event_type or extract_event_type(raw_payload)
    data = extract_event_data(raw_payload)
    status = provider_status or (data.get("status") if isinstance(data, dict) else None)
    kind = review_kind(str(status) if status else None, resolved_event)
    if kind is None:
        return None
    return _review_from_data(data if isinstance(data, dict) else {}, kind=kind, provider_status=status)


def _review_from_data(data: dict, *, kind: str, provider_status: Any) -> dict:
    expected = _first_positive(data, ("expectedAmount", "requestedAmount"))
    received = _first_positive(data, ("amount", "receivedAmount"))
    delta = received - expected if received is not None and expected is not None else None
    usdt_total = _first_positive(data, ("usdtTotal", "usdt_total"))
    rate = _first_positive(data, ("exchangeRate", "exchange_rate"))
    currency = data.get("currency") or data.get("receivedCurrency")
    return {
        "kind": kind,
        "provider_status": str(provider_status) if provider_status not in (None, "") else None,
        "expected_amount": format_crypto_amount(expected) if expected is not None else None,
        "received_amount": format_crypto_amount(received) if received is not None else None,
        "delta_amount": format_crypto_amount(delta) if delta is not None else None,
        "currency": str(currency) if currency not in (None, "") else None,
        "usdt_total": format_crypto_amount(usdt_total) if usdt_total is not None else None,
        "exchange_rate": format_crypto_amount(rate) if rate is not None else None,
        "credited": False,
    }


def _refresh_open_review(current: dict, raw_payload: dict) -> dict | None:
    data = extract_event_data(raw_payload)
    if not isinstance(data, dict) or not data:
        return None
    updated = _review_from_data(data, kind=str(current.get("kind")), provider_status=current.get("provider_status"))
    received = parse_amount(updated.get("received_amount"))
    expected = parse_amount(updated.get("expected_amount")) or parse_amount(current.get("expected_amount"))
    if received is None:
        received = parse_amount(current.get("received_amount"))
    if received is not None and expected is not None:
        if received > expected:
            updated["kind"] = "overpaid"
        elif received < expected:
            updated["kind"] = "underpaid"
        updated["expected_amount"] = format_crypto_amount(expected)
        updated["received_amount"] = format_crypto_amount(received)
        updated["delta_amount"] = format_crypto_amount(received - expected)
    else:
        updated["kind"] = current.get("kind")
        if updated.get("expected_amount") is None:
            updated["expected_amount"] = current.get("expected_amount")
        if updated.get("received_amount") is None:
            updated["received_amount"] = current.get("received_amount")
        if updated.get("delta_amount") is None:
            updated["delta_amount"] = current.get("delta_amount")
    for key in ("currency", "usdt_total", "exchange_rate", "provider_status"):
        if updated.get(key) in (None, ""):
            updated[key] = current.get(key)
    updated["credited"] = False
    if updated == current:
        return None
    return updated


def _first_positive(data: dict, keys: tuple[str, ...]) -> Decimal | None:
    for key in keys:
        parsed = parse_amount(data.get(key))
        if parsed is not None and parsed > 0:
            return parsed
    return None


def _amount_line(value: Any, suffix: str) -> str:
    if value in (None, ""):
        return "—"
    return f"{value}{suffix}"
