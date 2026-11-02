"""Merchant client for the Noren Digital payment API."""

from noren.client import DEFAULT_BASE_URL, NorenClient
from noren.errors import NorenError, NorenSignatureError
from noren.webhooks import (
    EVENT_HEADER,
    EVENT_ID_HEADER,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    is_failed_status,
    is_paid_status,
    is_settled_status,
    is_underpaid_status,
    parse_webhook,
    verify_and_parse,
    verify_webhook_signature,
)

__version__ = "0.1.0"

__all__ = [
    "DEFAULT_BASE_URL",
    "EVENT_HEADER",
    "EVENT_ID_HEADER",
    "NorenClient",
    "NorenError",
    "NorenSignatureError",
    "SIGNATURE_HEADER",
    "TIMESTAMP_HEADER",
    "__version__",
    "is_failed_status",
    "is_paid_status",
    "is_settled_status",
    "is_underpaid_status",
    "parse_webhook",
    "verify_and_parse",
    "verify_webhook_signature",
]
