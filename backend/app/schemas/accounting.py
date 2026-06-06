from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer


def _decimal_json_str(value: Decimal) -> str:
    """Avoid scientific notation in JSON for tiny decimals (e.g. 8e-8)."""
    return format(value, "f")


JsonDecimal = Annotated[Decimal, PlainSerializer(_decimal_json_str, return_type=str)]


class CryptoAmount(BaseModel):
    currency: str
    amount: JsonDecimal
    usd_value: JsonDecimal = Decimal("0")


class AccountingSummaryResponse(BaseModel):
    tenant_id: str | None
    invoices_total_count: int
    invoices_paid_count: int
    invoices_confirmed_count: int
    invoices_failed_count: int
    invoices_expired_count: int
    invoices_total_amount: JsonDecimal
    invoices_paid_amount: JsonDecimal
    invoices_confirmed_amount: JsonDecimal
    gross_amount: JsonDecimal
    provider_fee_amount: JsonDecimal
    platform_fee_amount: JsonDecimal
    turnover_fee_amount: JsonDecimal
    total_platform_revenue_amount: JsonDecimal
    net_amount: JsonDecimal
    average_invoice_amount: JsonDecimal
    crypto_amounts: list[CryptoAmount] = []
    total_usd_value: JsonDecimal = Decimal("0")
    exchange_rate_markup_percent: JsonDecimal = Decimal("0")


class MerchantBalanceTotals(BaseModel):
    currency: str = "USDT"
    available: JsonDecimal = Decimal("0")
    pending: JsonDecimal = Decimal("0")
    frozen: JsonDecimal = Decimal("0")
    locked: JsonDecimal = Decimal("0")
    withdrawn: JsonDecimal = Decimal("0")
    on_accounts: JsonDecimal = Decimal("0")


class TenantBalanceSnapshot(BaseModel):
    tenant_id: str
    tenant_name: str
    tenant_slug: str
    tenant_status: str
    available: JsonDecimal = Decimal("0")
    pending: JsonDecimal = Decimal("0")
    frozen: JsonDecimal = Decimal("0")
    locked: JsonDecimal = Decimal("0")
    withdrawn: JsonDecimal = Decimal("0")
    on_accounts: JsonDecimal = Decimal("0")


class PlatformAccountingOverviewResponse(BaseModel):
    currency: str = "USDT"
    summary: AccountingSummaryResponse
    gross_turnover: JsonDecimal
    provider_fees: JsonDecimal
    platform_earnings: JsonDecimal
    platform_earnings_accrued: JsonDecimal
    platform_earnings_withdrawn: JsonDecimal
    platform_earnings_outstanding: JsonDecimal
    merchant_net_credited: JsonDecimal
    merchant_balances: MerchantBalanceTotals
    payouts_pending_count: int = 0
    payouts_pending_amount: JsonDecimal = Decimal("0")
    active_tenants_count: int = 0
    tenants_with_balance_count: int = 0
    tenant_balances: list[TenantBalanceSnapshot] = Field(default_factory=list)
    platform_withdrawals: list["PlatformEarningsWithdrawalView"] = Field(default_factory=list)


class PlatformEarningsWithdrawalCreate(BaseModel):
    amount: Decimal = Field(gt=Decimal("0"))
    note: str | None = Field(default=None, max_length=500)
    external_reference: str | None = Field(default=None, max_length=255)
    withdrawn_at: datetime | None = None


class PlatformEarningsWithdrawalView(BaseModel):
    id: str
    amount: JsonDecimal
    currency: str
    note: str | None = None
    external_reference: str | None = None
    recorded_by_email: str | None = None
    withdrawn_at: datetime
    created_at: datetime
