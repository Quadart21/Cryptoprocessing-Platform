import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from secrets import token_hex

import requests
from requests.adapters import HTTPAdapter

from app.core.config import settings
from app.core.security import decrypt_value
from app.models.invoice import Invoice
from app.models.project import Project
from app.models.transaction import Transaction
from app.services.checkout_delivery_service import CheckoutDeliveryService
from app.services.event_service import EventService
from app.services.invoice_confirmations import confirmations_fields_from_stored
from app.services.payment_page_service import PaymentPageService


@dataclass
class DeliveryResult:
    ok: bool
    status_code: int
    response_preview: str | None
    error: str | None
    attempts: int


class ClientWebhookService:
    MAX_ATTEMPTS = 3
    RETRY_DELAYS_SECONDS = (0.0, 0.6, 1.2)
    SIGNATURE_HEADER = "X-Merset-Signature"
    _session: requests.Session | None = None

    def __init__(self, event_service: EventService):
        self.event_service = event_service

    async def deliver_invoice_update(
        self,
        project: Project | None,
        invoice: Invoice,
        transaction: Transaction | None,
        *,
        event_name: str = "invoice.status_changed",
    ) -> None:
        if project is None or not project.webhook_url:
            return

        delivery_id = f"wh_{token_hex(12)}"
        delivered_at = datetime.now(timezone.utc)
        payload = {
            "event": event_name,
            "event_id": delivery_id,
            "sent_at": delivered_at.isoformat(),
            "invoice": self._build_invoice_payload(invoice, project),
            "transaction": {
                "id": transaction.id,
                "status": transaction.status,
                "gross_amount": str(transaction.gross_amount),
                "total_fee": str(
                    Decimal(transaction.provider_fee)
                    + Decimal(transaction.platform_fee)
                    + Decimal(transaction.turnover_fee)
                ),
                "net_amount": str(transaction.net_amount),
                "currency": transaction.currency,
                "paid_at": transaction.paid_at.isoformat() if transaction.paid_at else None,
            }
            if transaction
            else None,
        }

        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        try:
            headers = self._build_headers(
                project=project,
                event_name=event_name,
                delivery_id=delivery_id,
                delivered_at=delivered_at,
                body=body,
            )
        except ValueError as exc:
            await self.event_service.create_event(
                invoice_id=invoice.id,
                event_type="client_webhook.failed",
                source="system",
                payload={
                    "webhook_url": project.webhook_url,
                    "event_id": delivery_id,
                    "event_name": event_name,
                    "error": str(exc),
                    "attempts": 0,
                },
                provider_name="platform-webhook",
                provider_event_id=delivery_id,
                status="failed",
            )
            return

        result = self._post_with_retry(project.webhook_url, body, headers)

        if result.ok:
            await self.event_service.create_event(
                invoice_id=invoice.id,
                event_type="client_webhook.sent",
                source="system",
                payload={
                    "webhook_url": project.webhook_url,
                    "event_id": delivery_id,
                    "event_name": event_name,
                    "status_code": result.status_code,
                    "response_preview": result.response_preview,
                    "attempts": result.attempts,
                },
                provider_name="platform-webhook",
                provider_event_id=delivery_id,
            )
            return

        await self.event_service.create_event(
            invoice_id=invoice.id,
            event_type="client_webhook.failed",
            source="system",
            payload={
                "webhook_url": project.webhook_url,
                "event_id": delivery_id,
                "event_name": event_name,
                "status_code": result.status_code,
                "response_preview": result.response_preview,
                "attempts": result.attempts,
                "error": result.error,
            },
            provider_name="platform-webhook",
            provider_event_id=delivery_id,
            status="failed",
        )

    def send_test_ping(self, project: Project) -> dict:
        if not project.webhook_url:
            raise ValueError("Для проекта не настроен webhook URL.")

        delivery_id = f"wh_test_{token_hex(8)}"
        delivered_at = datetime.now(timezone.utc)
        payload = {
            "event": "webhook.test",
            "event_id": delivery_id,
            "sent_at": delivered_at.isoformat(),
            "project_id": project.id,
            "message": "Тестовая доставка webhook от платформы.",
        }
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        headers = self._build_headers(
            project=project,
            event_name="webhook.test",
            delivery_id=delivery_id,
            delivered_at=delivered_at,
            body=body,
        )
        result = self._post_with_retry(project.webhook_url, body, headers)
        if not result.ok:
            reason = result.error or f"HTTP {result.status_code}"
            raise ValueError(f"Тестовый webhook не доставлен: {reason}.")

        return {
            "event_id": delivery_id,
            "delivered_at": delivered_at,
            "attempts": result.attempts,
            "status_code": result.status_code,
            "response_preview": result.response_preview,
        }

    def send_invoice_deposit_test(
        self,
        project: Project,
        invoice: Invoice,
        transaction: Transaction | None,
    ) -> dict:
        """Тестовый webhook «как при пополнении»: те же поля, что у боевого уведомления, без записи в БД."""
        if not project.webhook_url:
            raise ValueError("Для проекта не настроен webhook URL.")

        delivery_id = f"wh_test_dep_{token_hex(10)}"
        delivered_at = datetime.now(timezone.utc)
        event_name = "invoice.test_deposit"
        payload: dict = {
            "event": event_name,
            "event_id": delivery_id,
            "sent_at": delivered_at.isoformat(),
            "simulated": True,
            "message": "Тестовый webhook по инвойсу: статус инвойса и транзакций в системе не изменяются.",
            "invoice": self._build_invoice_payload(invoice, project),
            "transaction": {
                "id": transaction.id,
                "status": transaction.status,
                "gross_amount": str(transaction.gross_amount),
                "total_fee": str(
                    Decimal(transaction.provider_fee)
                    + Decimal(transaction.platform_fee)
                    + Decimal(transaction.turnover_fee)
                ),
                "net_amount": str(transaction.net_amount),
                "currency": transaction.currency,
                "paid_at": transaction.paid_at.isoformat() if transaction.paid_at else None,
            }
            if transaction
            else None,
        }

        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        headers = self._build_headers(
            project=project,
            event_name=event_name,
            delivery_id=delivery_id,
            delivered_at=delivered_at,
            body=body,
        )
        result = self._post_with_retry(project.webhook_url, body, headers)
        return {
            "event_id": delivery_id,
            "delivered_at": delivered_at,
            "attempts": result.attempts,
            "status_code": result.status_code,
            "response_preview": result.response_preview,
            "ok": result.ok,
            "error": result.error,
        }

    @staticmethod
    def _build_invoice_payload(invoice: Invoice, project: Project | None) -> dict:
        payment_fields = CheckoutDeliveryService.apply(
            project.checkout_delivery if project is not None else None,
            payment_page_url=PaymentPageService.payment_page_url_for(invoice),
            payment_address=invoice.payment_address,
            qr_url=invoice.qr_url,
        )
        return {
            "id": invoice.id,
            "project_id": invoice.project_id,
            "merchant_order_id": invoice.merchant_order_id,
            "provider_order_id": invoice.provider_order_id,
            "status": invoice.status,
            "amount_fiat": str(invoice.amount_fiat),
            "fiat_currency": invoice.fiat_currency,
            "amount_crypto": str(invoice.amount_crypto),
            "crypto_currency": invoice.crypto_currency,
            "network": invoice.network,
            "payment_address": payment_fields.payment_address,
            "payment_page_url": payment_fields.payment_page_url,
            "qr_url": payment_fields.qr_url,
            "checkout_delivery": payment_fields.checkout_delivery,
            "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
            "confirmed_at": invoice.confirmed_at.isoformat() if invoice.confirmed_at else None,
            **confirmations_fields_from_stored(invoice),
        }

    def _build_headers(
        self,
        *,
        project: Project,
        event_name: str,
        delivery_id: str,
        delivered_at: datetime,
        body: str,
    ) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Merset-Webhook/1.0",
            "X-Merset-Event": event_name,
            "X-Merset-Event-Id": delivery_id,
            "X-Merset-Timestamp": delivered_at.isoformat(),
        }
        secret_value = self._resolve_webhook_secret(project)
        if secret_value:
            digest = hmac.new(
                secret_value.encode("utf-8"),
                body.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            headers[self.SIGNATURE_HEADER] = f"sha256={digest}"
        return headers

    @staticmethod
    def _resolve_webhook_secret(project: Project) -> str | None:
        encrypted = (project.webhook_secret_encrypted or "").strip()
        if not encrypted:
            return None
        try:
            return decrypt_value(encrypted)
        except ValueError as exc:
            raise ValueError("Webhook secret cannot be decrypted. Re-save webhook settings.") from exc

    def _post_with_retry(
        self,
        webhook_url: str,
        body: str,
        headers: dict[str, str],
    ) -> DeliveryResult:
        status_code = 0
        response_preview: str | None = None
        error: str | None = None

        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            delay = self.RETRY_DELAYS_SECONDS[min(attempt - 1, len(self.RETRY_DELAYS_SECONDS) - 1)]
            if delay > 0:
                time.sleep(delay)

            try:
                response = self._get_http_session().post(
                    webhook_url,
                    data=body.encode("utf-8"),
                    headers=headers,
                    timeout=(
                        settings.client_webhook_connect_timeout_seconds,
                        settings.client_webhook_read_timeout_seconds,
                    ),
                )
                status_code = int(response.status_code)
                response_preview = self._trim_response(response.text)
                if 200 <= status_code < 300:
                    return DeliveryResult(
                        ok=True,
                        status_code=status_code,
                        response_preview=response_preview,
                        error=None,
                        attempts=attempt,
                    )
                error = f"HTTP {status_code}"
            except requests.RequestException as exc:
                error = str(exc)

        return DeliveryResult(
            ok=False,
            status_code=status_code,
            response_preview=response_preview,
            error=error,
            attempts=self.MAX_ATTEMPTS,
        )

    @staticmethod
    def _trim_response(value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.replace("\r", " ").replace("\n", " ").strip()
        return normalized[:500] if normalized else None

    @classmethod
    def _get_http_session(cls) -> requests.Session:
        if cls._session is not None:
            return cls._session
        session = requests.Session()
        adapter = HTTPAdapter(
            pool_connections=settings.client_webhook_pool_connections,
            pool_maxsize=settings.client_webhook_pool_maxsize,
            max_retries=0,
        )
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        cls._session = session
        return session

