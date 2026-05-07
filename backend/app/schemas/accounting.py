from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer


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
