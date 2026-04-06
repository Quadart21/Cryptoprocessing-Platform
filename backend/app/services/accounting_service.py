from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.transaction import Transaction
from app.schemas.accounting import AccountingSummaryResponse
from app.services.cache_service import get_cache_service


class AccountingService:
    CACHE_PREFIX = "accounting:summary:"

    def __init__(self, db: Session):
        self.db = db

    def build_summary(self, tenant_id: str | None = None) -> AccountingSummaryResponse:
        cache = get_cache_service()
        cache_key = self._build_cache_key(tenant_id)
        cached = cache.get_json(cache_key)
        if isinstance(cached, dict):
            try:
                return AccountingSummaryResponse.model_validate(cached)
            except Exception:
                cache.delete(cache_key)

        invoice_stmt = select(Invoice)
        transaction_stmt = select(Transaction)
        if tenant_id is not None:
            invoice_stmt = invoice_stmt.where(Invoice.tenant_id == tenant_id)
            transaction_stmt = transaction_stmt.where(Transaction.tenant_id == tenant_id)

        invoices = list(self.db.scalars(invoice_stmt).all())
        transactions = list(self.db.scalars(transaction_stmt).all())

        invoices_total_count = len(invoices)
        invoices_paid = [invoice for invoice in invoices if invoice.status in {"paid", "confirmed"}]
        invoices_confirmed = [invoice for invoice in invoices if invoice.status == "confirmed"]
        invoices_failed = [invoice for invoice in invoices if invoice.status == "failed"]
        invoices_expired = [invoice for invoice in invoices if invoice.status == "expired"]

        invoices_total_amount = sum((invoice.amount_fiat for invoice in invoices), Decimal("0"))
        invoices_paid_amount = sum((invoice.amount_fiat for invoice in invoices_paid), Decimal("0"))
        invoices_confirmed_amount = sum(
            (invoice.amount_fiat for invoice in invoices_confirmed), Decimal("0")
        )

        paid_transactions = [tx for tx in transactions if tx.status in {"paid", "confirmed"}]
        gross_amount = sum((tx.gross_amount for tx in paid_transactions), Decimal("0"))
        provider_fee_amount = sum((tx.provider_fee for tx in paid_transactions), Decimal("0"))
        platform_fee_amount = sum((tx.platform_fee for tx in paid_transactions), Decimal("0"))
        turnover_fee_amount = sum((tx.turnover_fee for tx in paid_transactions), Decimal("0"))
        total_platform_revenue_amount = platform_fee_amount + turnover_fee_amount
        net_amount = sum((tx.net_amount for tx in paid_transactions), Decimal("0"))
        average_invoice_amount = (
            (invoices_paid_amount / len(invoices_paid))
            if len(invoices_paid) > 0
            else Decimal("0")
        )

        payload = AccountingSummaryResponse(
            tenant_id=tenant_id,
            invoices_total_count=invoices_total_count,
            invoices_paid_count=len(invoices_paid),
            invoices_confirmed_count=len(invoices_confirmed),
            invoices_failed_count=len(invoices_failed),
            invoices_expired_count=len(invoices_expired),
            invoices_total_amount=invoices_total_amount,
            invoices_paid_amount=invoices_paid_amount,
            invoices_confirmed_amount=invoices_confirmed_amount,
            gross_amount=gross_amount,
            provider_fee_amount=provider_fee_amount,
            platform_fee_amount=platform_fee_amount,
            turnover_fee_amount=turnover_fee_amount,
            total_platform_revenue_amount=total_platform_revenue_amount,
            net_amount=net_amount,
            average_invoice_amount=average_invoice_amount,
        )
        cache.set_json(
            cache_key,
            payload.model_dump(mode="json"),
            ttl_seconds=settings.cache_accounting_summary_ttl_seconds,
        )
        return payload

    @classmethod
    def invalidate_cache(cls, tenant_id: str | None = None) -> None:
        cache = get_cache_service()
        if tenant_id is None:
            cache.delete_by_prefix(cls.CACHE_PREFIX)
            return
        cache.delete(cls._build_cache_key(tenant_id))
        cache.delete(cls._build_cache_key(None))

    @classmethod
    def _build_cache_key(cls, tenant_id: str | None) -> str:
        scope = tenant_id or "platform"
        return f"{cls.CACHE_PREFIX}{scope}"
