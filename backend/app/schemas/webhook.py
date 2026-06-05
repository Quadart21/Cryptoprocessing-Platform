from pydantic import BaseModel, Field, model_validator

from app.core.config import settings
from app.providers.crypto_cash_status import (
    extract_event_data,
    extract_event_type,
    extract_tx_hash,
    resolve_crypto_cash_status,
)


class CryptoCashWebhookPayload(BaseModel):
    id: str | None = Field(default=None, min_length=1, max_length=255)
    delivered_at: str | None = Field(default=None, max_length=100)
    event: dict | None = Field(default=None)
    signature: str | None = Field(default=None, min_length=16)

    provider_order_id: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, min_length=2, max_length=50)
    tx_hash: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_payload(self) -> "CryptoCashWebhookPayload":
        if self.is_official_format:
            return self

        if settings.legacy_webhook_payload_allowed and self.provider_order_id and self.status:
            return self

        raise ValueError(
            "Webhook payload must use official format: id, delivered_at, event, signature."
        )

    @property
    def is_official_format(self) -> bool:
        return self.event is not None and self.id is not None and self.delivered_at is not None

    @property
    def resolved_event_type(self) -> str | None:
        if not isinstance(self.event, dict):
            return None
        for key in ("type", "event_type", "eventType"):
            value = self.event.get(key)
            if value not in (None, ""):
                return str(value)
        return None

    @property
    def resolved_provider_order_id(self) -> str | None:
        if self.provider_order_id:
            return self.provider_order_id
        value = self._event_data.get("id")
        return str(value) if value else None

    @property
    def resolved_merchant_order_id(self) -> str | None:
        value = self._event_data.get("externalId")
        return str(value) if value else None

    @property
    def resolved_status(self) -> str | None:
        if self.status:
            return self.status
        value = self._event_data.get("status")
        return str(value) if value else None

    @property
    def resolved_tx_hash(self) -> str | None:
        if self.tx_hash:
            return self.tx_hash
        value = self._event_data.get("hash")
        if value in (None, ""):
            return None
        return str(value)

    @property
    def resolved_platform_status(self) -> str:
        return resolve_crypto_cash_status(
            status=self.resolved_status,
            event_type=self.resolved_event_type,
        )

    @property
    def cancel_reason(self) -> str | None:
        value = self._event_data.get("cancelReason")
        if value in (None, ""):
            return None
        return str(value)

    @property
    def _event_data(self) -> dict:
        if isinstance(self.event, dict):
            data = self.event.get("data")
            if isinstance(data, dict):
                return data
        return {}

    @classmethod
    def parse_raw(cls, raw_payload: dict) -> "CryptoCashWebhookPayload":
        return cls.model_validate(raw_payload)


def webhook_context_from_raw(raw_payload: dict) -> dict:
    """Extract CC webhook fields for logging / stored invoice payload."""
    data = extract_event_data(raw_payload)
    return {
        "event_type": extract_event_type(raw_payload),
        "provider_status": data.get("status"),
        "tx_hash": extract_tx_hash(raw_payload),
        "cancel_reason": data.get("cancelReason"),
        "received_amount": data.get("receivedAmount"),
        "received_currency": data.get("receivedCurrency"),
        "amount": data.get("amount"),
        "usdt_total": data.get("usdtTotal"),
        "exchange_rate": data.get("exchangeRate"),
    }
