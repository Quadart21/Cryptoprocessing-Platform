from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class StatisticsExclusion(Base):
    """Исключение тенанта из платформенной статистики и сводной бухгалтерии."""

    __tablename__ = "statistics_exclusions"

    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )
    reason: Mapped[str] = mapped_column(String(64), nullable=False, default="sandbox", index=True)
    merchant_sandbox_id: Mapped[str | None] = mapped_column(
        ForeignKey("merchant_sandboxes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
