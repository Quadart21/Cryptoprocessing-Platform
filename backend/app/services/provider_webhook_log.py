import json
import logging
from typing import Any

logger = logging.getLogger("app.crypto_cash.webhook")


def _compact_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)
    except TypeError:
        return repr(value)


class ProviderWebhookLogService:
    """Structured journal for Crypto-Cash webhooks and status callbacks."""

    @staticmethod
    def log_incoming(
        *,
        outcome: str,
        source: str = "webhook",
        provider_event_id: str | None = None,
        provider_order_id: str | None = None,
        merchant_order_id: str | None = None,
        provider_status: str | None = None,
        effective_status: str | None = None,
        previous_status: str | None = None,
        invoice_id: str | None = None,
        raw_payload: dict | None = None,
        detail: str | None = None,
    ) -> None:
        summary = (
            "Crypto-Cash callback outcome=%s source=%s event_id=%s "
            "provider_order_id=%s merchant_order_id=%s provider_status=%s "
            "effective_status=%s previous_status=%s invoice_id=%s detail=%s"
        )
        logger.info(
            summary,
            outcome,
            source,
            provider_event_id or "-",
            provider_order_id or "-",
            merchant_order_id or "-",
            provider_status or "-",
            effective_status or "-",
            previous_status or "-",
            invoice_id or "-",
            detail or "-",
        )
        if raw_payload is not None:
            logger.info("Crypto-Cash payload: %s", _compact_json(raw_payload))
