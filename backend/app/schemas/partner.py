from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PartnerApplyRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    display_name: str = Field(min_length=2, max_length=255)
    contact_telegram: str | None = Field(default=None, max_length=100)
    payout_address: str | None = Field(default=None, max_length=255)
    payout_network: str = Field(default="TRC20", max_length=50)


class PartnerApplyResponse(BaseModel):
    partner_id: str
    user_id: str
    status: str
    referral_code: str
    message: str


class PartnerProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=255)
    contact_telegram: str | None = Field(default=None, max_length=100)
    payout_address: str | None = Field(default=None, max_length=255)
    payout_network: str | None = Field(default=None, max_length=50)


class PartnerMeResponse(BaseModel):
    partner_id: str
    user_id: str
    email: str
    full_name: str
    display_name: str
    contact_telegram: str | None
    status: str
    referral_code: str
    referral_link_path: str
    commission_percent: Decimal
    payout_address: str | None
    payout_network: str
    review_comment: str | None
    hold_days: int
    min_payout_usdt: Decimal
    cookie_days: int
    pending_hold_usdt: Decimal
    available_usdt: Decimal
    paid_usdt: Decimal
    locked_payout_usdt: Decimal
    clicks: int
    registrations: int
    approved_merchants: int
    merchants_with_volume: int


class PartnerMerchantRow(BaseModel):
    tenant_id: str
    tenant_name: str
    tenant_status: str
    created_at: datetime
    platform_fee_usdt: Decimal
    commission_usdt: Decimal


class PartnerCommissionRow(BaseModel):
    id: str
    tenant_id: str
    tenant_name: str
    invoice_id: str
    platform_fee_amount: Decimal
    commission_percent: Decimal
    commission_amount: Decimal
    currency: str
    status: str
    available_at: datetime
    created_at: datetime


class PartnerPayoutCreateRequest(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    destination_address: str | None = Field(default=None, max_length=255)
    network: str | None = Field(default=None, max_length=50)


class PartnerPayoutRow(BaseModel):
    id: str
    amount_requested: Decimal
    amount_approved: Decimal | None
    destination_address: str
    network: str
    currency: str
    status: str
    review_comment: str | None
    created_at: datetime
    processed_at: datetime | None


class PartnerReferralClickRequest(BaseModel):
    referral_code: str = Field(min_length=3, max_length=32)
    landing_path: str | None = Field(default=None, max_length=500)


class AdminPartnerUpdateRequest(BaseModel):
    status: str | None = None
    commission_percent: Decimal | None = None
    clear_commission_override: bool = False
    review_comment: str | None = Field(default=None, max_length=500)
    notes: str | None = None
    payout_address: str | None = Field(default=None, max_length=255)
    payout_network: str | None = Field(default=None, max_length=50)


class AdminPartnerListItem(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    display_name: str
    status: str
    referral_code: str
    commission_percent: Decimal | None
    effective_commission_percent: Decimal
    contact_telegram: str | None
    payout_address: str | None
    payout_network: str
    pending_hold_usdt: Decimal
    available_usdt: Decimal
    paid_usdt: Decimal
    registrations: int
    created_at: datetime
    approved_at: datetime | None


class AdminPartnerDetailResponse(AdminPartnerListItem):
    review_comment: str | None
    notes: str | None
    merchants: list[PartnerMerchantRow]
    recent_commissions: list[PartnerCommissionRow]
    payouts: list[PartnerPayoutRow]


class AdminPartnerPayoutReviewRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    amount_approved: Decimal | None = Field(default=None, gt=0)
    review_comment: str | None = Field(default=None, max_length=500)
    external_reference: str | None = Field(default=None, max_length=255)


class AdminTenantReferralUpdateRequest(BaseModel):
    referral_partner_id: str | None = None


class AffiliateSettingsResponse(BaseModel):
    # Legacy flat fields (kept for compatibility with older UI clients).
    affiliate_commission_percent: Decimal
    affiliate_hold_days: int
    affiliate_min_payout_usdt: Decimal
    affiliate_cookie_days: int
    # Full ultra-wide config for superadmin.
    config: dict


class AffiliateSettingsUpdateRequest(BaseModel):
    # Accept either legacy flat fields or full config dict (or both; config wins).
    affiliate_commission_percent: Decimal | None = Field(default=None, ge=0, le=100)
    affiliate_hold_days: int | None = Field(default=None, ge=0, le=365)
    affiliate_min_payout_usdt: Decimal | None = Field(default=None, ge=0)
    affiliate_cookie_days: int | None = Field(default=None, ge=1, le=730)
    config: dict | None = None


class PublicAffiliateConfigResponse(BaseModel):
    program_enabled: bool
    public_apply_enabled: bool
    cookie_days: int
    click_mode: str
    default_payout_network: str
    allowed_payout_networks: list[str]
    require_payout_address_on_apply: bool
    commission_percent: Decimal
    hold_days: int
    min_payout_usdt: Decimal
    attribution_mode: str
    attribution_days: int
