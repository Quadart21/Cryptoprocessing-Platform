import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone, timedelta

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.webhook import CryptoCashWebhookPayload
from app.services.event_service import EventService


class CryptoCashWebhookSecurityError(Exception):
    pass


class CryptoCashWebhookSecurityService:
    PROVIDER_NAME = "crypto-cash"

    def __init__(self, db: Session):
        self.event_service = EventService(db)

    def verify(self, payload: CryptoCashWebhookPayload, raw_payload: dict) -> None:
        if not payload.is_official_format:
            if settings.legacy_webhook_payload_allowed:
                return
            raise CryptoCashWebhookSecurityError(
                "Legacy webhook payload is disabled for this environment."
            )

        assert payload.id is not None
        assert payload.delivered_at is not None

        if (
            self.event_service.get_event_by_provider_event_id(
                payload.id,
                provider_name=self.PROVIDER_NAME,
            )
            is not None
        ):
            raise CryptoCashWebhookSecurityError(
                "Webhook replay detected: event_id was already processed."
            )

        delivered_at = self._parse_delivered_at(payload.delivered_at)
        max_skew = timedelta(seconds=max(settings.webhook_max_skew_seconds, 30))
        if abs(datetime.now(timezone.utc) - delivered_at) > max_skew:
            raise CryptoCashWebhookSecurityError(
                "Webhook timestamp is outside the allowed replay-protection window."
            )

        if not payload.signature:
            raise CryptoCashWebhookSecurityError(
                "Webhook signature is required in production."
                if settings.is_production
                else "Webhook signature is required."
            )

        signing_payload = {
            "id": raw_payload.get("id"),
            "delivered_at": raw_payload.get("delivered_at"),
            "event": raw_payload.get("event"),
        }
        message = self._build_message(signing_payload)

        if self._verify_ed25519(payload.signature, message):
            return
        if settings.legacy_webhook_signature_allowed and self._verify_legacy(
            payload.signature, message
        ):
            return

        raise CryptoCashWebhookSecurityError("Webhook signature verification failed.")

    @staticmethod
    def _parse_delivered_at(value: str) -> datetime:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError as exc:
            raise CryptoCashWebhookSecurityError(
                "Webhook timestamp format is invalid."
            ) from exc

    @staticmethod
    def _build_message(payload: dict) -> bytes:
        raw_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        encoded = base64.b64encode(raw_json.encode("utf-8")).decode("utf-8")
        return encoded.encode("utf-8")

    @staticmethod
    def _verify_ed25519(signature: str, message: bytes) -> bool:
        if not settings.crypto_cash_public_key:
            return False
        try:
            public_key = Ed25519PublicKey.from_public_bytes(
                bytes.fromhex(settings.crypto_cash_public_key)
            )
            public_key.verify(base64.b64decode(signature), message)
            return True
        except (ValueError, InvalidSignature):
            return False

    @staticmethod
    def _verify_legacy(signature: str, message: bytes) -> bool:
        if not settings.effective_webhook_secret:
            return False
        digest = hashlib.sha256(
            settings.effective_webhook_secret.encode("utf-8") + message
        ).digest()
        expected = base64.b64encode(digest).decode("utf-8")
        return hmac.compare_digest(expected, signature)

