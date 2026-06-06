from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PlatformEarningsWithdrawal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Фиксация вывода комиссии платформы с баланса Crypto-Cash (ручной учёт)."""

    __tablename__ = "platform_earnings_withdrawals"

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False, default="USDT")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    external_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recorded_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    withdrawn_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
