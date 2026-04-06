from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TenantBoundMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TenantBalance(UUIDPrimaryKeyMixin, TenantBoundMixin, TimestampMixin, Base):
    __tablename__ = "tenant_balances"
    __table_args__ = (
        CheckConstraint("available_amount >= 0", name="ck_tenant_balance_available_amount_positive"),
        CheckConstraint("pending_amount >= 0", name="ck_tenant_balance_pending_amount_positive"),
        CheckConstraint("locked_amount >= 0", name="ck_tenant_balance_locked_amount_positive"),
        CheckConstraint("withdrawn_amount >= 0", name="ck_tenant_balance_withdrawn_amount_positive"),
        CheckConstraint("provider_gross_amount >= 0", name="ck_tenant_balance_provider_gross_amount_positive"),
    )

    currency: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    available_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False, default=0)
    pending_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False, default=0)
    locked_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False, default=0)
    withdrawn_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False, default=0)
    provider_gross_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 8), nullable=False, default=0
    )
    updated_balance_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
