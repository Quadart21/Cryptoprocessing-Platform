from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class PayoutRequestCreateRequest(BaseModel):
    project_id: str | None = None
    destination_address: str = Field(min_length=10, max_length=255)
    amount: Decimal = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class PayoutReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    review_comment: str | None = Field(default=None, max_length=500)
    external_payout_id: str | None = Field(default=None, max_length=255)
    amount_approved: Decimal | None = Field(default=None, gt=0)


class PayoutRequestResponse(BaseModel):
    id: str
    tenant_id: str
    tenant_name: str | None = None
    project_id: str | None
    project_name: str | None = None
    requested_by_user_id: str | None
    reviewed_by_user_id: str | None
    destination_address: str
    network: str
    currency: str
    amount_requested: Decimal
    amount_approved: Decimal | None
    status: str
    review_comment: str | None
    external_payout_id: str | None
    processed_at: datetime | None
    created_at: datetime
