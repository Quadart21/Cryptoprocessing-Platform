from pydantic import BaseModel, Field, model_validator

from app.core.config import settings


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
    def resolved_provider_order_id(self) -> str | None:
        if self.provider_order_id:
            return self.provider_order_id
        event_data = self._event_data
        value = event_data.get("id")
        return str(value) if value else None

    @property
    def resolved_merchant_order_id(self) -> str | None:
        event_data = self._event_data
        value = event_data.get("externalId")
        return str(value) if value else None

    @property
    def resolved_status(self) -> str | None:
        if self.status:
            return self.status
        event_data = self._event_data
        value = event_data.get("status")
        return str(value) if value else None

    @property
    def resolved_tx_hash(self) -> str | None:
        if self.tx_hash:
            return self.tx_hash
        event_data = self._event_data
        value = event_data.get("hash")
        return str(value) if value else None

    @property
    def _event_data(self) -> dict:
        if not isinstance(self.event, dict):
            return {}
        data = self.event.get("data")
        if isinstance(data, dict):
            return data
        return {}
