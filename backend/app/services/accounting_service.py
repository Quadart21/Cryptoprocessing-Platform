from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.payout_request import PayoutRequest
from app.models.tenant import Tenant
from app.models.tenant_balance import TenantBalance
from app.models.transaction import Transaction
from app.schemas.accounting import (
    AccountingSummaryResponse,
    CryptoAmount,
    MerchantBalanceTotals,
    PlatformAccountingOverviewResponse,
    PlatformEarningsWithdrawalView,
    TenantBalanceSnapshot,
)
from app.services.billing_policy_service import BillingPolicyService
from app.services.cache_service import get_cache_service
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.statistics_exclusion_service import StatisticsExclusionService


class AccountingService:
    CACHE_PREFIX = "accounting:summary:"
    OVERVIEW_CACHE_PREFIX = "accounting:platform_overview:"
    BALANCE_CURRENCY = "USDT"

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

    async def build_platform_overview(self) -> PlatformAccountingOverviewResponse:
        cache = get_cache_service()
        cache_key = self.OVERVIEW_CACHE_PREFIX
        cached = cache.get_json(cache_key)
        if isinstance(cached, dict):
            try:
                return PlatformAccountingOverviewResponse.model_validate(cached)
            except Exception:
                cache.delete(cache_key)

        summary = await self.build_summary(tenant_id=None)
        excluded = await StatisticsExclusionService(self.db).excluded_tenant_ids()

        balance_filters = [TenantBalance.currency.in_((self.BALANCE_CURRENCY, "USD"))]
        if excluded:
            balance_filters.append(TenantBalance.tenant_id.not_in(excluded))

        balance_rows = list(
            (
                await self.db.scalars(
                    select(TenantBalance).where(*balance_filters)
                )
            ).all()
        )

        totals = MerchantBalanceTotals(currency=self.BALANCE_CURRENCY)
        per_tenant: dict[str, dict[str, Decimal | str]] = {}
        for row in balance_rows:
            tenant_key = row.tenant_id
            bucket = per_tenant.setdefault(
                tenant_key,
                {
                    "available": Decimal("0"),
                    "pending": Decimal("0"),
                    "frozen": Decimal("0"),
                    "locked": Decimal("0"),
                    "withdrawn": Decimal("0"),
                },
            )
            bucket["available"] = Decimal(bucket["available"]) + Decimal(row.available_amount)
            bucket["pending"] = Decimal(bucket["pending"]) + Decimal(row.pending_amount)
            bucket["frozen"] = Decimal(bucket["frozen"]) + Decimal(row.frozen_amount)
            bucket["locked"] = Decimal(bucket["locked"]) + Decimal(row.locked_amount)
            bucket["withdrawn"] = Decimal(bucket["withdrawn"]) + Decimal(row.withdrawn_amount)

            totals.available += Decimal(row.available_amount)
            totals.pending += Decimal(row.pending_amount)
            totals.frozen += Decimal(row.frozen_amount)
            totals.locked += Decimal(row.locked_amount)
            totals.withdrawn += Decimal(row.withdrawn_amount)

        totals.on_accounts = (
            totals.available + totals.pending + totals.frozen + totals.locked
        )

        payout_stmt = select(PayoutRequest).where(PayoutRequest.status == "pending_review")
        if excluded:
            payout_stmt = payout_stmt.where(PayoutRequest.tenant_id.not_in(excluded))
        pending_payouts = list((await self.db.scalars(payout_stmt)).all())
        payouts_pending_amount = sum(
            (Decimal(item.amount_requested) for item in pending_payouts),
            Decimal("0"),
        )

        tenant_stmt = select(Tenant)
        if excluded:
            tenant_stmt = tenant_stmt.where(Tenant.id.not_in(excluded))
        tenants = list((await self.db.scalars(tenant_stmt)).all())
        tenants_by_id = {item.id: item for item in tenants}

        tenant_snapshots: list[TenantBalanceSnapshot] = []
        for tenant_id, amounts in per_tenant.items():
            tenant = tenants_by_id.get(tenant_id)
            if tenant is None:
                continue
            on_accounts = (
                Decimal(amounts["available"])
                + Decimal(amounts["pending"])
                + Decimal(amounts["frozen"])
                + Decimal(amounts["locked"])
            )
            tenant_snapshots.append(
                TenantBalanceSnapshot(
                    tenant_id=tenant_id,
                    tenant_name=tenant.name,
                    tenant_slug=tenant.slug,
                    tenant_status=tenant.status,
                    available=Decimal(amounts["available"]),
                    pending=Decimal(amounts["pending"]),
                    frozen=Decimal(amounts["frozen"]),
                    locked=Decimal(amounts["locked"]),
                    withdrawn=Decimal(amounts["withdrawn"]),
                    on_accounts=on_accounts,
                )
            )
        tenant_snapshots.sort(
            key=lambda item: Decimal(item.on_accounts),
            reverse=True,
        )

        active_tenants_count = sum(
            1 for tenant in tenants if tenant.status in {"approved", "active"}
        )
        tenants_with_balance_count = sum(
            1 for item in tenant_snapshots if Decimal(item.on_accounts) > Decimal("0")
        )

        from app.services.platform_earnings_service import PlatformEarningsService

        earnings_service = PlatformEarningsService(self.db)
        platform_earnings_accrued = Decimal(summary.total_platform_revenue_amount)
        platform_earnings_withdrawn = await earnings_service.total_withdrawn()
        platform_earnings_outstanding = platform_earnings_accrued - platform_earnings_withdrawn
        withdrawal_rows = await earnings_service.list_withdrawals(limit=100)
        platform_withdrawals = [PlatformEarningsWithdrawalView(**item) for item in withdrawal_rows]

        payload = PlatformAccountingOverviewResponse(
            currency=self.BALANCE_CURRENCY,
            summary=summary,
            gross_turnover=summary.gross_amount,
            provider_fees=summary.provider_fee_amount,
            platform_earnings=platform_earnings_accrued,
            platform_earnings_accrued=platform_earnings_accrued,
            platform_earnings_withdrawn=platform_earnings_withdrawn,
            platform_earnings_outstanding=platform_earnings_outstanding,
            merchant_net_credited=summary.net_amount,
            merchant_balances=totals,
            payouts_pending_count=len(pending_payouts),
            payouts_pending_amount=payouts_pending_amount,
            active_tenants_count=active_tenants_count,
            tenants_with_balance_count=tenants_with_balance_count,
            tenant_balances=tenant_snapshots,
            platform_withdrawals=platform_withdrawals,
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
        cache.delete_by_prefix(cls.OVERVIEW_CACHE_PREFIX)

    @classmethod
    def _build_cache_key(cls, tenant_id: str | None, exchange_rate_markup: Decimal = Decimal("0")) -> str:
        scope = tenant_id or "platform"
        markup_str = str(exchange_rate_markup.normalize())
        return f"{cls.CACHE_PREFIX}{scope}:{markup_str}"
