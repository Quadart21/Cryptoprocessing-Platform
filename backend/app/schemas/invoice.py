from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class InvoiceCreateRequest(BaseModel):
    project_id: str
    merchant_order_id: str = Field(min_length=1, max_length=255)
    amount_fiat: Decimal = Field(gt=0)
    fiat_currency: str = Field(default="USD", min_length=3, max_length=10)
    crypto_currency: str = Field(default="USDT", min_length=2, max_length=20)
    network: str = Field(default="TRC20", min_length=2, max_length=50)
    metadata: dict | None = None


class InvoiceResponse(BaseModel):
    id: str
    project_id: str
    merchant_order_id: str
    provider_order_id: str
    amount_fiat: Decimal
    fiat_currency: str
    amount_crypto: Decimal
    crypto_currency: str
    network: str
    payment_address: str
    qr_url: str | None
    payment_page_url: str | None = None
    status: str
    expires_at: datetime
    created_at: datetime


class PublicPaymentResponse(BaseModel):
    status: str
    amount_crypto: Decimal
    crypto_currency: str
    network: str
    amount_fiat: Decimal
    fiat_currency: str
    payment_address: str
    qr_url: str | None
    expires_at: datetime
    merchant_order_id: str


class InvoiceAdminDetailResponse(InvoiceResponse):
    tenant_id: str
    paid_at: datetime | None
    confirmed_at: datetime | None
    metadata_json: dict | None
    raw_provider_payload_json: dict | None


class InvoiceStatusUpdateRequest(BaseModel):
    status: str = Field(min_length=2, max_length=50)
    tx_hash: str | None = Field(default=None, max_length=255)


class BalanceResponse(BaseModel):
    currency: str
    amount: Decimal
    available_amount: Decimal
    locked_amount: Decimal
    total_amount: Decimal
