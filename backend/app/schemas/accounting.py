from decimal import Decimal

from pydantic import BaseModel


class AccountingSummaryResponse(BaseModel):
    tenant_id: str | None
    invoices_total_count: int
    invoices_paid_count: int
    invoices_confirmed_count: int
    invoices_failed_count: int
    invoices_expired_count: int
    invoices_total_amount: Decimal
    invoices_paid_amount: Decimal
    invoices_confirmed_amount: Decimal
    gross_amount: Decimal
    provider_fee_amount: Decimal
    platform_fee_amount: Decimal
    turnover_fee_amount: Decimal
    total_platform_revenue_amount: Decimal
    net_amount: Decimal
    average_invoice_amount: Decimal
