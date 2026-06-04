from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TenantBoundMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Transaction(UUIDPrimaryKeyMixin, TenantBoundMixin, TimestampMixin, Base):
    __tablename__ = "transactions"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    provider_fee: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    turnover_fee: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False, default=Decimal("0"))
    net_amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    balance_available_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    balance_released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
