"""Track underpaid / overpaid deposits on one invoice (cumulative amount + top-ups)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from app.providers.crypto_cash_status import extract_event_data, extract_event_type, normalize_provider_status_key

STORED_AMOUNT_REVIEW_KEY = "amount_review"
STORED_PROVIDER_DEPOSITS_KEY = "provider_deposits"
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


def should_keep_credited_invoice(
    previous_status: str,
    raw_normalized: str,
    *,
    old_received: Decimal | None = None,
    new_received: Decimal | None = None,
) -> bool:
    """Ignore a later mismatch webhook only when it does not raise the cumulative amount."""
    if previous_status != "confirmed" or raw_normalized not in AMOUNT_REVIEW_PLATFORM_STATUSES:
        return False
    if (
        old_received is not None
        and new_received is not None
        and new_received > old_received
    ):
        return False
    return True


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
    expected = parse_amount(review.get("expected_amount"))
    received = parse_amount(review.get("received_amount"))
    remaining = None
    if (
        review.get("kind") == "underpaid"
        and expected is not None
        and received is not None
        and expected > received
    ):
        remaining = format_crypto_amount(expected - received)
    return {
        "kind": review.get("kind"),
        "provider_status": review.get("provider_status"),
        "expected_amount": review.get("expected_amount"),
        "received_amount": review.get("received_amount"),
        "delta_amount": review.get("delta_amount"),
        "remaining_amount": remaining,
        "currency": review.get("currency"),
        "usdt_total": review.get("usdt_total"),
        "exchange_rate": review.get("exchange_rate"),
        "credited": bool(review.get("credited")),
        "deposits": list(stored_payload.get(STORED_PROVIDER_DEPOSITS_KEY) or [])
        if isinstance(stored_payload, dict)
        else [],
    }


def append_provider_deposit(stored_payload: dict, raw_payload: dict | None) -> bool:
    """Append an individual deposit_received slice; link by order id stays on the invoice."""
    if not isinstance(raw_payload, dict):
        return False
    event_type = (extract_event_type(raw_payload) or "").strip().lower()
    data = extract_event_data(raw_payload)
    if not isinstance(data, dict):
        return False
    received = parse_amount(data.get("receivedAmount"))
    if received is None or received <= 0:
        return False
    if event_type and event_type != "acquiring::deposit_received":
        # Only deposit_received carries a non-cumulative receivedAmount.
        # Other events may still repeat the last receivedAmount as null.
        pass
    tx_hash = data.get("hash")
    webhook_id = raw_payload.get("id")
    cumulative = parse_amount(data.get("amount"))
    entry = {
        "webhook_event_id": str(webhook_id) if webhook_id not in (None, "") else None,
        "tx_hash": str(tx_hash) if tx_hash not in (None, "") else None,
        "received_amount": format_crypto_amount(received),
        "received_currency": str(data.get("receivedCurrency") or data.get("currency") or "") or None,
        "received_network": str(data.get("receivedNetwork") or data.get("network") or "") or None,
        "cumulative_amount": format_crypto_amount(cumulative) if cumulative is not None else None,
        "event_type": event_type or None,
    }
    deposits = [
        item for item in (stored_payload.get(STORED_PROVIDER_DEPOSITS_KEY) or []) if isinstance(item, dict)
    ]
    for existing in deposits:
        if entry["webhook_event_id"] and existing.get("webhook_event_id") == entry["webhook_event_id"]:
            return False
        if (
            entry["tx_hash"]
            and existing.get("tx_hash") == entry["tx_hash"]
            and existing.get("received_amount") == entry["received_amount"]
        ):
            return False
    deposits.append(entry)
    stored_payload[STORED_PROVIDER_DEPOSITS_KEY] = deposits
    return True


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
            # Exact match after top-up — mismatch review is done.
            if _exact_match_after_topup(current, raw_payload):
                stored_payload.pop(STORED_AMOUNT_REVIEW_KEY, None)
                return True
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
    if kind == "underpaid":
        title = "Недоплата — ждём доплату на ту же заявку"
    else:
        title = "Переплата — зачислили фактическую сумму"
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
    if kind == "underpaid":
        remaining = None
        expected = parse_amount(review.get("expected_amount"))
        received = parse_amount(review.get("received_amount"))
        if expected is not None and received is not None and expected > received:
            remaining = format_crypto_amount(expected - received)
        lines.append(
            f"Клиенту нужно доплатить {_amount_line(remaining, suffix)} на тот же адрес."
            if remaining
            else "Клиенту нужно доплатить разницу на тот же адрес."
        )
        lines.append("Второй депозит придёт отдельным вебхуком и останется на этой же заявке.")
    elif review.get("received_amount"):
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
    # amount = cumulative across partial deposits; receivedAmount = one deposit only.
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
        if received == expected:
            return None
        if received > expected:
            updated["kind"] = "overpaid"
        else:
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


def _exact_match_after_topup(current: dict, raw_payload: dict) -> bool:
    data = extract_event_data(raw_payload)
    if not isinstance(data, dict):
        return False
    expected = parse_amount(data.get("expectedAmount")) or parse_amount(current.get("expected_amount"))
    received = parse_amount(data.get("amount"))
    return expected is not None and received is not None and expected == received


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
