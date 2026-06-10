from decimal import Decimal

from sqlalchemy import and_, case, func, or_, select
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

_ZERO = Decimal("0")
_PAID_STATUSES = ("paid", "confirmed")


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

        invoice_filters = await self._invoice_filters(tenant_id)
        latest_tx = self._latest_transaction_subquery()

        status_rows = (
            await self.db.execute(
                select(Invoice.status, func.count())
                .where(*invoice_filters)
                .group_by(Invoice.status)
            )
        ).all()
        status_counts = {status: count for status, count in status_rows}

        invoices_total_count = sum(status_counts.values())
        invoices_paid_count = sum(status_counts.get(status, 0) for status in _PAID_STATUSES)
        invoices_confirmed_count = status_counts.get("confirmed", 0)
        invoices_failed_count = status_counts.get("failed", 0)
        invoices_expired_count = sum(
            status_counts.get(status, 0) for status in ("expired", "cancelled")
        )

        invoice_value = case(
            (
                and_(
                    Invoice.status.in_(_PAID_STATUSES),
                    latest_tx.c.gross_amount.is_not(None),
                    latest_tx.c.gross_amount > 0,
                ),
                latest_tx.c.gross_amount,
            ),
            else_=Invoice.amount_fiat,
        )

        invoices_total_amount = Decimal(
            (
                await self.db.scalar(
                    select(func.coalesce(func.sum(invoice_value), 0))
                    .select_from(Invoice)
                    .outerjoin(latest_tx, latest_tx.c.invoice_id == Invoice.id)
                    .where(*invoice_filters)
                )
            )
            or 0
        )

        paid_financials = (
            await self.db.execute(
                select(
                    func.coalesce(func.sum(latest_tx.c.gross_amount), 0),
                    func.coalesce(func.sum(latest_tx.c.provider_fee), 0),
                    func.coalesce(func.sum(latest_tx.c.platform_fee), 0),
                    func.coalesce(func.sum(latest_tx.c.turnover_fee), 0),
                    func.coalesce(func.sum(latest_tx.c.net_amount), 0),
                    func.count(),
                )
                .select_from(Invoice)
                .join(latest_tx, latest_tx.c.invoice_id == Invoice.id)
                .where(*invoice_filters)
                .where(Invoice.status.in_(_PAID_STATUSES))
                .where(latest_tx.c.gross_amount > 0)
            )
        ).one()

        gross_amount = Decimal(paid_financials[0] or 0)
        provider_fee_amount = Decimal(paid_financials[1] or 0)
        platform_fee_amount = Decimal(paid_financials[2] or 0)
        turnover_fee_amount = Decimal(paid_financials[3] or 0)
        net_amount = Decimal(paid_financials[4] or 0)
        settled_paid_count = int(paid_financials[5] or 0)

        invoices_paid_amount = gross_amount
        invoices_confirmed_amount = Decimal(
            (
                await self.db.scalar(
                    select(
                        func.coalesce(
                            func.sum(
                                case(
                                    (
                                        latest_tx.c.gross_amount > 0,
                                        latest_tx.c.gross_amount,
                                    ),
                                    else_=Invoice.amount_fiat,
                                )
                            ),
                            0,
                        )
                    )
                    .select_from(Invoice)
                    .outerjoin(latest_tx, latest_tx.c.invoice_id == Invoice.id)
                    .where(*invoice_filters)
                    .where(Invoice.status == "confirmed")
                )
            )
            or 0
        )

        unsettled_paid = await self.db.scalars(
            select(Invoice)
            .outerjoin(latest_tx, latest_tx.c.invoice_id == Invoice.id)
            .where(*invoice_filters)
            .where(Invoice.status.in_(_PAID_STATUSES))
            .where(or_(latest_tx.c.invoice_id.is_(None), latest_tx.c.gross_amount <= 0))
        )
        unsettled_invoices = list(unsettled_paid.all())
        if unsettled_invoices:
            from app.services.invoice_service import InvoiceService

            invoice_service = InvoiceService(self.db)
            for invoice in unsettled_invoices:
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
                if invoice.status == "confirmed":
                    invoices_confirmed_amount += fiat_value

        total_platform_revenue_amount = platform_fee_amount + turnover_fee_amount
        paid_count_for_average = settled_paid_count + len(unsettled_invoices)
        average_invoice_amount = (
            (invoices_paid_amount / paid_count_for_average)
            if paid_count_for_average > 0
            else _ZERO
        )

        crypto_rows = (
            await self.db.execute(
                select(Invoice.crypto_currency, func.coalesce(func.sum(Invoice.amount_crypto), 0))
                .where(*invoice_filters)
                .where(Invoice.status.in_(_PAID_STATUSES))
                .where(Invoice.amount_crypto > 0)
                .group_by(Invoice.crypto_currency)
            )
        ).all()
        crypto_amounts = await self._crypto_amounts_from_totals(crypto_rows, exchange_rate_markup)
        total_usd_value = self._calculate_total_usd_value(crypto_amounts)

        payload = AccountingSummaryResponse(
            tenant_id=tenant_id,
            invoices_total_count=invoices_total_count,
            invoices_paid_count=invoices_paid_count,
            invoices_confirmed_count=invoices_confirmed_count,
            invoices_failed_count=invoices_failed_count,
            invoices_expired_count=invoices_expired_count,
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
                    "available": _ZERO,
                    "pending": _ZERO,
                    "frozen": _ZERO,
                    "locked": _ZERO,
                    "withdrawn": _ZERO,
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
            _ZERO,
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
            1 for item in tenant_snapshots if Decimal(item.on_accounts) > _ZERO
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

    async def _invoice_filters(self, tenant_id: str | None) -> list:
        if tenant_id is not None:
            return [Invoice.tenant_id == tenant_id]
        excluded = await StatisticsExclusionService(self.db).excluded_tenant_ids()
        if excluded:
            return [Invoice.tenant_id.not_in(excluded)]
        return []

    def _latest_transaction_subquery(self):
        latest_created = (
            select(
                Transaction.invoice_id.label("invoice_id"),
                func.max(Transaction.created_at).label("created_at"),
            )
            .group_by(Transaction.invoice_id)
            .subquery("latest_tx_created")
        )
        return (
            select(
                Transaction.invoice_id.label("invoice_id"),
                Transaction.gross_amount.label("gross_amount"),
                Transaction.provider_fee.label("provider_fee"),
                Transaction.platform_fee.label("platform_fee"),
                Transaction.turnover_fee.label("turnover_fee"),
                Transaction.net_amount.label("net_amount"),
            )
            .join(
                latest_created,
                and_(
                    Transaction.invoice_id == latest_created.c.invoice_id,
                    Transaction.created_at == latest_created.c.created_at,
                ),
            )
            .subquery("latest_tx")
        )

    async def _crypto_amounts_from_totals(
        self,
        crypto_rows: list,
        exchange_rate_markup: Decimal,
    ) -> list[CryptoAmount]:
        rate_service = get_exchange_rate_service()
        result: list[CryptoAmount] = []
        for currency, amount in sorted(crypto_rows, key=lambda row: row[0]):
            crypto_amount = Decimal(amount or 0)
            if crypto_amount <= 0:
                continue
            normalized_currency = str(currency).upper()
            usd_value = await rate_service.convert_to_fiat(
                crypto_amount,
                normalized_currency,
                "USD",
                exchange_rate_markup,
            )
            usd = usd_value if usd_value is not None else _ZERO
            result.append(
                CryptoAmount(
                    currency=normalized_currency,
                    amount=crypto_amount.quantize(Decimal("0.00000001")),
                    usd_value=usd,
                )
            )
        return result

    def _calculate_total_usd_value(self, crypto_amounts: list[CryptoAmount]) -> Decimal:
        return sum((ca.usd_value for ca in crypto_amounts), _ZERO)

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
