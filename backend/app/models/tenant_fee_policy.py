from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TenantFeePolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenant_fee_policies"

    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, unique=True, index=True
    )
    custom_markup_percent: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    custom_turnover_fee_percent: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    payouts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    requires_manual_payout_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
