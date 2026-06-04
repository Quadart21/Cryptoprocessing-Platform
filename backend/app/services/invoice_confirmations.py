from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.services.rates_service import RatesService

STORED_ACTUAL_KEY = "network_confirmations_actual"
STORED_REQUIRED_KEY = "network_confirmations_required"


def parse_confirmation_count(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _payload_candidates(raw_payload: dict | None) -> list[dict]:
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
        if "actualConfirmations" in data or "requiredConfirmations" in data:
            candidates.append(data)

    if "actualConfirmations" in raw_payload or "requiredConfirmations" in raw_payload:
        candidates.append(raw_payload)

    return candidates


def extract_confirmations_from_provider_payload(
    raw_payload: dict | None,
) -> tuple[int | None, int | None]:
    actual: int | None = None
    required: int | None = None
    for candidate in _payload_candidates(raw_payload):
        if actual is None:
            actual = parse_confirmation_count(candidate.get("actualConfirmations"))
        if required is None:
            required = parse_confirmation_count(candidate.get("requiredConfirmations"))
        if actual is not None and required is not None:
            break
    return actual, required


def read_stored_confirmations(invoice: Invoice) -> tuple[int | None, int | None]:
    payload = invoice.raw_provider_payload_json or {}
    actual = parse_confirmation_count(payload.get(STORED_ACTUAL_KEY))
    required = parse_confirmation_count(payload.get(STORED_REQUIRED_KEY))
    return actual, required


def apply_confirmations_to_stored_payload(
    stored_payload: dict,
    raw_payload: dict | None,
) -> bool:
    actual, required = extract_confirmations_from_provider_payload(raw_payload)
    changed = False
    if actual is not None and stored_payload.get(STORED_ACTUAL_KEY) != actual:
        stored_payload[STORED_ACTUAL_KEY] = actual
        changed = True
    if required is not None and required > 0 and stored_payload.get(STORED_REQUIRED_KEY) != required:
        stored_payload[STORED_REQUIRED_KEY] = required
        changed = True
    return changed


def seed_required_confirmations(stored_payload: dict, required: int | None) -> bool:
    if required is None or required <= 0:
        return False
    if stored_payload.get(STORED_REQUIRED_KEY) == required:
        return False
    stored_payload[STORED_REQUIRED_KEY] = required
    return True


async def resolve_invoice_network_confirmations(
    db: AsyncSession | None,
    invoice: Invoice,
) -> tuple[int | None, int | None]:
    actual, required = read_stored_confirmations(invoice)
    if db is not None and (required is None or required <= 0):
        try:
            fallback = await RatesService(db).get_network_confirmations_required(
                currency=invoice.crypto_currency,
                network=invoice.network,
            )
        except ValueError:
            fallback = None
        if fallback is not None and fallback > 0:
            required = fallback
    if required is not None and required <= 0:
        required = None
    return actual, required


def confirmations_fields_from_stored(invoice: Invoice) -> dict[str, int | None]:
    actual, required = read_stored_confirmations(invoice)
    if required is not None and required <= 0:
        required = None
    return {
        "network_confirmations_actual": actual,
        "network_confirmations_required": required,
    }


async def confirmations_fields_for_invoice(
    db: AsyncSession | None,
    invoice: Invoice,
) -> dict[str, int | None]:
    actual, required = await resolve_invoice_network_confirmations(db, invoice)
    return {
        "network_confirmations_actual": actual,
        "network_confirmations_required": required,
    }


def confirmations_complete(
    stored_payload: dict | None,
    *,
    actual: int | None = None,
    required: int | None = None,
) -> bool:
    """True when required confirmations are met (or network has no requirement)."""
    if actual is None or required is None:
        if stored_payload:
            stored_actual, stored_required = read_stored_confirmations_from_payload(stored_payload)
            actual = actual if actual is not None else stored_actual
            required = required if required is not None else stored_required
    if required is None or required <= 0:
        return True
    if actual is None:
        return False
    return actual >= required


def read_stored_confirmations_from_payload(stored_payload: dict) -> tuple[int | None, int | None]:
    actual = parse_confirmation_count(stored_payload.get(STORED_ACTUAL_KEY))
    required = parse_confirmation_count(stored_payload.get(STORED_REQUIRED_KEY))
    return actual, required
