from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class AssetAvailability(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "asset_availability_rules"
    __table_args__ = (
        UniqueConstraint(
            "currency",
            "network",
            name="uq_asset_availability_rules_currency_network",
        ),
    )

    currency: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    network: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
