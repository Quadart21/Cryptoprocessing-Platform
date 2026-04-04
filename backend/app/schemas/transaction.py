from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class TransactionResponse(BaseModel):
    id: str
    tenant_id: str
    project_id: str
    invoice_id: str
    gross_amount: Decimal
    provider_fee: Decimal
    platform_fee: Decimal
    turnover_fee: Decimal
    net_amount: Decimal
    currency: str
    status: str
    paid_at: datetime | None
    created_at: datetime
