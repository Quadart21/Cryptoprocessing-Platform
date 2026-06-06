import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.project import Project
from app.schemas.invoice import PublicPaymentResponse
from app.services.invoice_confirmations import confirmations_fields_for_invoice
from app.services.invoice_lifecycle import invoice_allows_payment_credentials
from app.services.payment_memo import read_stored_payment_memo


class PaymentPageService:
    TOKEN_BYTES = 32

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(PaymentPageService.TOKEN_BYTES)

    @staticmethod
    def build_page_url(payment_token: str | None) -> str | None:
        token = (payment_token or "").strip()
        if not token:
            return None
        pay_base = (settings.public_pay_base_url or "").strip().rstrip("/")
        if pay_base:
            return f"{pay_base}/{token}"
        api_base = (settings.public_api_base_url or "").strip().rstrip("/")
        if not api_base:
            return None
        return f"{api_base}/pay/{token}"

    @classmethod
    def payment_page_url_for(cls, invoice: Invoice) -> str | None:
        return cls.build_page_url(invoice.payment_token)

    async def get_invoice_by_token(self, payment_token: str) -> Invoice | None:
        normalized = payment_token.strip()
        if not normalized:
            return None
        return await self.db.scalar(
            select(Invoice).where(Invoice.payment_token == normalized)
        )

    async def ensure_payment_token(self, invoice: Invoice) -> str:
        if invoice.payment_token:
            return invoice.payment_token
        invoice.payment_token = self.generate_token()
        self.db.add(invoice)
        await self.db.flush()
        return invoice.payment_token

    async def to_public_response(self, invoice: Invoice) -> PublicPaymentResponse:
        project = await self.db.get(Project, invoice.project_id)
        merchant_name = project.name if project is not None else None
        return_url_success = project.return_url_success if project is not None else None
        return_url_failed = project.return_url_failed if project is not None else None
        confirmations = await confirmations_fields_for_invoice(self.db, invoice)
        allow_credentials = invoice_allows_payment_credentials(invoice)
        payment_memo = (
            read_stored_payment_memo(invoice.raw_provider_payload_json) if allow_credentials else None
        )
        return PublicPaymentResponse(
            status=invoice.status,
            amount_crypto=invoice.amount_crypto,
            crypto_currency=invoice.crypto_currency,
            network=invoice.network,
            amount_fiat=invoice.amount_fiat,
            fiat_currency=invoice.fiat_currency,
            payment_address=invoice.payment_address if allow_credentials else None,
            payment_memo=payment_memo,
            qr_url=invoice.qr_url if allow_credentials else None,
            expires_at=invoice.expires_at,
            merchant_order_id=invoice.merchant_order_id,
            merchant_name=merchant_name,
            return_url_success=return_url_success,
            return_url_failed=return_url_failed,
            **confirmations,
        )
