from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Tenant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending_review")
    review_comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="UTC")
    base_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="default")
    # use_alter breaks partners→users→tenants→partners cycle for metadata.sort
    referral_partner_id: Mapped[str | None] = mapped_column(
        ForeignKey(
            "partners.id",
            use_alter=True,
            name="fk_tenants_referral_partner_id",
        ),
        nullable=True,
        index=True,
    )
