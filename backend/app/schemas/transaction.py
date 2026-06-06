from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class TransactionResponse(BaseModel):
    id: str
    tenant_id: str
    project_id: str
    invoice_id: str
    amount_crypto: Decimal | None = None
    crypto_currency: str | None = None
    gross_amount: Decimal
    provider_fee: Decimal | None = None
    platform_fee: Decimal | None = None
    turnover_fee: Decimal | None = None
    total_fee: Decimal | None = None
    net_amount: Decimal
    currency: str
    status: str
    invoice_status: str | None = None
    paid_at: datetime | None
    created_at: datetime
