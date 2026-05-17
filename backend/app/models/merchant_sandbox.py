from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class MerchantSandbox(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Тестовый контур «стороннего мерчанта»: привязка к тенанту и метаданные деплоя."""

    __tablename__ = "merchant_sandboxes"
    __table_args__ = (
        UniqueConstraint("dns_parent_zone", "desired_subdomain", name="uq_merchant_sandboxes_zone_subdomain"),
    )

    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    dns_parent_zone: Mapped[str] = mapped_column(String(255), nullable=False)
    desired_subdomain: Mapped[str] = mapped_column(String(63), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft", index=True)

    enrollment_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    enrollment_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    agent_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    agent_public_id: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True, index=True)
    agent_instance_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    origin_ipv4: Mapped[str | None] = mapped_column(String(45), nullable=True)

    cloudflare_zone_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cloudflare_dns_record_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    public_base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
