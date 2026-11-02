"""Verify inbound merchant webhooks (header X-Merset-Signature)."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any, Mapping

from noren.errors import NorenError, NorenSignatureError

SIGNATURE_HEADER = "X-Merset-Signature"
EVENT_HEADER = "X-Merset-Event"
EVENT_ID_HEADER = "X-Merset-Event-Id"
TIMESTAMP_HEADER = "X-Merset-Timestamp"

# Money is credited and the order can be fulfilled.
PAID_STATUSES = frozenset({"paid", "confirmed", "overpaid"})
# Deposit is short. The invoice stays open until a top-up or accept-received.
UNDERPAID_STATUSES = frozenset({"underpaid"})
FAILED_STATUSES = frozenset({"expired", "cancelled", "canceled", "failed"})


def header_value(headers: Mapping[str, str] | None, name: str) -> str | None:
    """Read a header. HTTP frameworks may change the name's case."""
    if not headers:
        return None
    target = name.lower()
    for key, value in headers.items():
        if str(key).lower() == target and value not in (None, ""):
            return str(value)
    return None


def verify_webhook_signature(raw_body: bytes | str, signature_header: str | None, webhook_secret: str) -> bool:
    """Return True when ``signature_header`` is HMAC-SHA256 of the raw body.

    The platform signs the exact bytes it sent (``sha256=<hex>``). Re-encoding
    JSON before the check will fail, so pass the untouched request body.
    """
    if not signature_header or not webhook_secret:
        return False
    signature = signature_header.strip()
    prefix = "sha256="
    if not signature.lower().startswith(prefix):
        return False
    digest = signature[len(prefix) :]
    if len(digest) != 64 or any(char not in "0123456789abcdefABCDEF" for char in digest):
        return False

    body = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    expected = hmac.new(webhook_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, digest.lower())


def parse_webhook(raw_body: bytes | str) -> dict[str, Any]:
    """Decode a webhook body. Raises ``NorenError`` when it is not a JSON object."""
    text = raw_body.decode("utf-8") if isinstance(raw_body, bytes) else raw_body
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise NorenError("Webhook body is not valid JSON.") from exc
    if not isinstance(payload, dict):
        raise NorenError("Webhook body must be a JSON object.")
    return payload


def _parse_timestamp(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def verify_and_parse(
    raw_body: bytes | str,
    signature_header: str | None,
    webhook_secret: str,
    *,
    timestamp_header: str | None = None,
    tolerance_seconds: int | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Check the signature and return the payload.

    ``tolerance_seconds`` also checks ``X-Merset-Timestamp`` against the clock.
    Leave it unset to match the PHP helper, which checks the signature only.
    """
    if not verify_webhook_signature(raw_body, signature_header, webhook_secret):
        raise NorenSignatureError("Webhook signature verification failed.")

    if tolerance_seconds is not None:
        if tolerance_seconds < 0:
            raise ValueError("tolerance_seconds must be >= 0")
        if not timestamp_header:
            raise NorenSignatureError("Webhook timestamp is missing.")
        try:
            delivered_at = _parse_timestamp(timestamp_header)
        except ValueError as exc:
            raise NorenSignatureError("Webhook timestamp format is invalid.") from exc
        current = now or datetime.now(timezone.utc)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        skew = abs((current.astimezone(timezone.utc) - delivered_at).total_seconds())
        if skew > tolerance_seconds:
            raise NorenSignatureError("Webhook timestamp is outside the allowed window.")

    return parse_webhook(raw_body)


def is_paid_status(status: str | None) -> bool:
    """True for paid, confirmed, and overpaid."""
    return _normalized(status) in PAID_STATUSES


def is_underpaid_status(status: str | None) -> bool:
    """True when the deposit is short and the invoice is still open."""
    return _normalized(status) in UNDERPAID_STATUSES


def is_failed_status(status: str | None) -> bool:
    """True for expired, cancelled, and failed invoices."""
    return _normalized(status) in FAILED_STATUSES


def is_settled_status(status: str | None, amount_review: Mapping[str, Any] | None = None) -> bool:
    """True when the merchant can fulfill the order.

    Underpaid invoices count only after ``amount_review.credited`` is true
    (the buyer topped up, or the merchant called accept-received).
    """
    normalized = _normalized(status)
    if normalized in PAID_STATUSES:
        return True
    if normalized in UNDERPAID_STATUSES and amount_review and amount_review.get("credited") is True:
        return True
    return False


def _normalized(status: str | None) -> str:
    return (status or "").strip().lower()
