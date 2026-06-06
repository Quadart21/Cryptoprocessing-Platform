from __future__ import annotations

from typing import Any
from urllib.parse import quote, urlencode

STORED_MEMO_KEY = "payment_memo"


def _normalize_memo(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    normalized = value.strip()
    return normalized or None


def _payload_memo_candidates(raw_payload: dict | None) -> list[dict]:
    if not isinstance(raw_payload, dict):
        return []

    candidates: list[dict] = []

    def append_candidate(payload: dict | None) -> None:
        if not isinstance(payload, dict):
            return
        event = payload.get("event")
        if isinstance(event, dict):
            data = event.get("data")
            if isinstance(data, dict):
                candidates.append(data)
        data = payload.get("data")
        if isinstance(data, dict):
            item = data.get("item")
            if isinstance(item, dict):
                candidates.append(item)
            candidates.append(data)

    append_candidate(raw_payload)
    return candidates


def extract_memo_from_provider_payload(raw_payload: dict | None) -> str | None:
    for candidate in _payload_memo_candidates(raw_payload):
        memo = _normalize_memo(candidate.get("memo"))
        if memo is not None:
            return memo
    if isinstance(raw_payload, dict):
        return _normalize_memo(raw_payload.get("memo"))
    return None


def read_stored_payment_memo(stored_payload: dict | None) -> str | None:
    if not isinstance(stored_payload, dict):
        return None
    memo = _normalize_memo(stored_payload.get(STORED_MEMO_KEY))
    if memo is not None:
        return memo
    return _normalize_memo(stored_payload.get("memo"))


def apply_memo_to_stored_payload(
    stored_payload: dict,
    raw_payload: dict | None,
) -> bool:
    memo = extract_memo_from_provider_payload(raw_payload)
    if memo is None:
        return False
    if stored_payload.get(STORED_MEMO_KEY) == memo:
        return False
    stored_payload[STORED_MEMO_KEY] = memo
    return True


def build_payment_qr_data(address: str, memo: str | None = None) -> str | None:
    normalized_address = (address or "").strip()
    if not normalized_address:
        return None
    normalized_memo = _normalize_memo(memo)
    if normalized_memo:
        return f"{normalized_address}?{urlencode({'memo': normalized_memo})}"
    return normalized_address


def build_payment_qr_url(
    address: str,
    memo: str | None = None,
    *,
    size: int = 360,
) -> str | None:
    qr_data = build_payment_qr_data(address, memo)
    if not qr_data:
        return None
    return (
        f"https://api.qrserver.com/v1/create-qr-code/"
        f"?size={size}x{size}&data={quote(qr_data, safe='')}"
    )


def sync_invoice_qr_with_memo(invoice, stored_payload: dict | None = None) -> bool:
    stored = stored_payload if stored_payload is not None else (invoice.raw_provider_payload_json or {})
    memo = read_stored_payment_memo(stored if isinstance(stored, dict) else None)
    new_qr = build_payment_qr_url(invoice.payment_address, memo, size=200)
    if new_qr and invoice.qr_url != new_qr:
        invoice.qr_url = new_qr
        return True
    return False
