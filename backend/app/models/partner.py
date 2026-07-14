from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Partner(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """External affiliate (not a merchant tenant)."""

    __tablename__ = "partners"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    referral_code: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, index=True
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_telegram: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    # Null = use platform default commission percent.
    commission_percent: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    payout_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payout_network: Mapped[str] = mapped_column(String(50), nullable=False, default="TRC20")
    review_comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PartnerReferralEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Click / attribution event for funnel stats."""

    __tablename__ = "partner_referral_events"

    partner_id: Mapped[str] = mapped_column(
        ForeignKey("partners.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, default="click")
    referral_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    landing_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tenant_id: Mapped[str | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class PartnerPayoutRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "partner_payout_requests"

    partner_id: Mapped[str] = mapped_column(
        ForeignKey("partners.id"), nullable=False, index=True
    )
    requested_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    destination_address: Mapped[str] = mapped_column(String(255), nullable=False)
    network: Mapped[str] = mapped_column(String(50), nullable=False, default="TRC20")
    currency: Mapped[str] = mapped_column(String(20), nullable=False, default="USDT")
    amount_requested: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    amount_approved: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending_review")
    review_comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)


class PartnerCommission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Commission accrued from a settled invoice's platform_fee."""

    __tablename__ = "partner_commissions"
    __table_args__ = (
        UniqueConstraint("transaction_id", name="uq_partner_commissions_transaction"),
    )

    partner_id: Mapped[str] = mapped_column(
        ForeignKey("partners.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    invoice_id: Mapped[str] = mapped_column(
        ForeignKey("invoices.id"), nullable=False, index=True
    )
    transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id"), nullable=False, index=True
    )
    platform_fee_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    commission_percent: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False, default="USDT")
    # pending_hold | available | locked_payout | paid | clawed_back
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending_hold")
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payout_request_id: Mapped[str | None] = mapped_column(
        ForeignKey("partner_payout_requests.id"), nullable=True, index=True
    )
