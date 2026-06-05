from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.transaction import Transaction
from app.schemas.accounting import AccountingSummaryResponse, CryptoAmount
from app.services.billing_policy_service import BillingPolicyService
from app.services.cache_service import get_cache_service
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.statistics_exclusion_service import StatisticsExclusionService


class AccountingService:
    CACHE_PREFIX = "accounting:summary:"

    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_summary(self, tenant_id: str | None = None) -> AccountingSummaryResponse:
        billing_service = BillingPolicyService(self.db)
        exchange_rate_markup = await billing_service.get_exchange_rate_markup_percent()

        cache = get_cache_service()
        cache_key = self._build_cache_key(tenant_id, exchange_rate_markup)
        cached = cache.get_json(cache_key)
        if isinstance(cached, dict):
            try:
                return AccountingSummaryResponse.model_validate(cached)
            except Exception:
                cache.delete(cache_key)

        invoice_stmt = select(Invoice)
        if tenant_id is not None:
            invoice_stmt = invoice_stmt.where(Invoice.tenant_id == tenant_id)
        else:
            excluded = await StatisticsExclusionService(self.db).excluded_tenant_ids()
            if excluded:
                invoice_stmt = invoice_stmt.where(Invoice.tenant_id.not_in(excluded))

        invoices = list((await self.db.scalars(invoice_stmt)).all())
        invoice_ids = [invoice.id for invoice in invoices]
        transactions_by_invoice: dict[str, Transaction] = {}
        if invoice_ids:
            transaction_rows = list(
                (
                    await self.db.scalars(
                        select(Transaction).where(Transaction.invoice_id.in_(invoice_ids))
                    )
                ).all()
            )
            transactions_by_invoice = {
                transaction.invoice_id: transaction for transaction in transaction_rows
            }

        invoices_total_count = len(invoices)
        invoices_paid = [invoice for invoice in invoices if invoice.status in {"paid", "confirmed"}]
        invoices_confirmed = [invoice for invoice in invoices if invoice.status == "confirmed"]
        invoices_failed = [invoice for invoice in invoices if invoice.status == "failed"]
        invoices_expired = [
            invoice for invoice in invoices if invoice.status in {"expired", "cancelled"}
        ]

        invoices_total_amount = Decimal("0")
        invoices_paid_amount = Decimal("0")
        invoices_confirmed_amount = Decimal("0")
        gross_amount = Decimal("0")
        provider_fee_amount = Decimal("0")
        platform_fee_amount = Decimal("0")
        turnover_fee_amount = Decimal("0")
        net_amount = Decimal("0")

        from app.services.invoice_service import InvoiceService

        invoice_service = InvoiceService(self.db)

        for invoice in invoices:
            transaction = transactions_by_invoice.get(invoice.id)
            if (
                invoice.status in {"paid", "confirmed"}
                and transaction is not None
                and transaction.gross_amount > Decimal("0")
            ):
                fiat_value = Decimal(transaction.gross_amount)
            else:
                fiat_value = Decimal(invoice.amount_fiat)
            invoices_total_amount += fiat_value

        for invoice in invoices_paid:
            transaction = transactions_by_invoice.get(invoice.id)
            if transaction is not None and transaction.gross_amount > Decimal("0"):
                fiat_value = Decimal(transaction.gross_amount)
                provider_fee = Decimal(transaction.provider_fee)
                platform_fee = Decimal(transaction.platform_fee)
                turnover_fee = Decimal(transaction.turnover_fee)
                invoice_net = Decimal(transaction.net_amount)
            else:
                try:
                    fiat_value = await invoice_service.resolve_accounting_gross_amount(
                        amount_crypto=Decimal(invoice.amount_crypto),
                        crypto_currency=invoice.crypto_currency,
                        fiat_currency=invoice.fiat_currency,
                        exchange_rate_markup=exchange_rate_markup,
                    )
                except ValueError:
                    fiat_value = Decimal(invoice.amount_fiat)
                (
                    provider_fee,
                    platform_fee,
                    turnover_fee,
                    invoice_net,
                ) = await invoice_service._calculate_financials(
                    tenant_id=invoice.tenant_id,
                    gross_amount=fiat_value,
                    fiat_currency=invoice.fiat_currency,
                )
            invoices_paid_amount += fiat_value
            gross_amount += fiat_value
            provider_fee_amount += provider_fee
            platform_fee_amount += platform_fee
            turnover_fee_amount += turnover_fee
            net_amount += invoice_net

        for invoice in invoices_confirmed:
            transaction = transactions_by_invoice.get(invoice.id)
            if transaction is not None and transaction.gross_amount > Decimal("0"):
                fiat_value = Decimal(transaction.gross_amount)
            else:
                try:
                    fiat_value = await invoice_service.resolve_accounting_gross_amount(
                        amount_crypto=Decimal(invoice.amount_crypto),
                        crypto_currency=invoice.crypto_currency,
                        fiat_currency=invoice.fiat_currency,
                        exchange_rate_markup=exchange_rate_markup,
                    )
                except ValueError:
                    fiat_value = Decimal(invoice.amount_fiat)
            invoices_confirmed_amount += fiat_value

        total_platform_revenue_amount = platform_fee_amount + turnover_fee_amount
        average_invoice_amount = (
            (invoices_paid_amount / len(invoices_paid))
            if len(invoices_paid) > 0
            else Decimal("0")
        )

        crypto_amounts = await self._calculate_crypto_amounts(invoices, exchange_rate_markup)
        total_usd_value = self._calculate_total_usd_value(crypto_amounts)

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
            crypto_amounts=crypto_amounts,
            total_usd_value=total_usd_value,
            exchange_rate_markup_percent=exchange_rate_markup,
        )
        cache.set_json(
            cache_key,
            payload.model_dump(mode="json"),
            ttl_seconds=settings.cache_accounting_summary_ttl_seconds,
        )
        return payload

    async def _calculate_crypto_amounts(
        self,
        invoices: list[Invoice],
        exchange_rate_markup: Decimal,
    ) -> list[CryptoAmount]:
        crypto_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

        for invoice in invoices:
            if invoice.status in {"paid", "confirmed"} and invoice.amount_crypto and invoice.crypto_currency:
                currency = invoice.crypto_currency.upper()
                crypto_totals[currency] += invoice.amount_crypto

        rate_service = get_exchange_rate_service()
        markup_percent = exchange_rate_markup

        result = []
        for currency, amount in sorted(crypto_totals.items()):
            if amount > 0:
                usd_value = await rate_service.convert_to_fiat(amount, currency, "USD", markup_percent)
                usd = usd_value if usd_value is not None else Decimal("0")
                result.append(CryptoAmount(
                    currency=currency,
                    amount=amount.quantize(Decimal("0.00000001")),
                    usd_value=usd,
                ))

        return result

    def _calculate_total_usd_value(self, crypto_amounts: list[CryptoAmount]) -> Decimal:
        return sum((ca.usd_value for ca in crypto_amounts), Decimal("0"))

    @classmethod
    def invalidate_cache(cls, tenant_id: str | None = None) -> None:
        cache = get_cache_service()
        cache.delete_by_prefix(cls.CACHE_PREFIX)

    @classmethod
    def _build_cache_key(cls, tenant_id: str | None, exchange_rate_markup: Decimal = Decimal("0")) -> str:
        scope = tenant_id or "platform"
        markup_str = str(exchange_rate_markup.normalize())
        return f"{cls.CACHE_PREFIX}{scope}:{markup_str}"
