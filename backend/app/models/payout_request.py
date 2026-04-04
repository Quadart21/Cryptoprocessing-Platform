from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TenantBoundMixin, TimestampMixin, UUIDPrimaryKeyMixin


class PayoutRequest(UUIDPrimaryKeyMixin, TenantBoundMixin, TimestampMixin, Base):
    __tablename__ = "payout_requests"

    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    requested_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    destination_address: Mapped[str] = mapped_column(String(255), nullable=False)
    network: Mapped[str] = mapped_column(String(50), nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False)
    amount_requested: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    amount_approved: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending_review")
    external_payout_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    review_comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
