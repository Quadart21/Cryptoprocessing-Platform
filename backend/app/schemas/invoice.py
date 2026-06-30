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
    payment_address: str | None = None
    payment_memo: str | None = None
    qr_url: str | None = None
    payment_page_url: str | None = None
    checkout_delivery: str = "payment_page"
    status: str
    network_confirmations_actual: int | None = None
    network_confirmations_required: int | None = None
    expires_at: datetime
    created_at: datetime


class InvoiceSettlementResponse(BaseModel):
    """Merchant-facing settlement; single fee line, no provider/platform split."""

    amount_crypto: Decimal
    crypto_currency: str
    gross_amount: Decimal
    total_fee: Decimal
    net_amount: Decimal
    currency: str
    is_final: bool
    paid_at: datetime | None = None


class InvoiceTransactionDetailsResponse(BaseModel):
    """Structured payment record similar to provider dashboard rows."""

    operation_type: str = "sale"
    created_at: datetime
    last_updated_at: datetime
    paid_at: datetime | None = None
    trading_pair: str
    amount_crypto: Decimal
    crypto_currency: str
    amount_fiat: Decimal
    fiat_currency: str
    status: str
    exchange_id: str
    wallet_address: str | None = None
    payment_memo: str | None = None
    tx_hash: str | None = None
    exchange_rate: Decimal | None = None
    exchange_rate_currency: str
    processing_commission: Decimal | None = None
    platform_commission: Decimal | None = None
    total_commission: Decimal | None = None
    network_commission: Decimal | None = None
    network_commission_currency: str | None = None
    commission_currency: str
    network_confirmations_actual: int | None = None
    network_confirmations_required: int | None = None
    is_estimate: bool = False


class InvoiceDetailResponse(InvoiceResponse):
    settlement: InvoiceSettlementResponse | None = None
    transaction_details: InvoiceTransactionDetailsResponse | None = None


class PublicPaymentResponse(BaseModel):
    status: str
    amount_crypto: Decimal
    crypto_currency: str
    network: str
    amount_fiat: Decimal
    fiat_currency: str
    payment_address: str | None = None
    payment_memo: str | None = None
    qr_url: str | None = None
    network_confirmations_actual: int | None = None
    network_confirmations_required: int | None = None
    expires_at: datetime
    merchant_order_id: str
    merchant_name: str | None = None
    return_url_success: str | None = None
    return_url_failed: str | None = None


class InvoiceAdminDetailResponse(InvoiceResponse):
    tenant_id: str
    paid_at: datetime | None
    confirmed_at: datetime | None
    metadata_json: dict | None
    raw_provider_payload_json: dict | None
    transaction_details: InvoiceTransactionDetailsResponse | None = None


class InvoiceStatusUpdateRequest(BaseModel):
    status: str = Field(min_length=2, max_length=50)
    tx_hash: str | None = Field(default=None, max_length=255)


class InvoiceStatusOptionResponse(BaseModel):
    value: str


class BalanceHoldItem(BaseModel):
    transaction_id: str
    invoice_id: str
    merchant_order_id: str
    amount: Decimal
    available_at: datetime


class BalanceResponse(BaseModel):
    currency: str
    amount: Decimal
    available_amount: Decimal
    frozen_amount: Decimal
    pending_amount: Decimal
    locked_amount: Decimal
    total_amount: Decimal
    hold_hours: int
    next_release_at: datetime | None = None
    holds: list[BalanceHoldItem] = Field(default_factory=list)
