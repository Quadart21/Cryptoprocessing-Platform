from decimal import Decimal

from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PlatformSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "platform_settings"

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    provider_fee_percent: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0.2000")
    )
    default_markup_percent: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0.0000")
    )
    default_turnover_fee_percent: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0.0000")
    )
    allow_tenant_markup_override: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    allow_tenant_turnover_fee_override: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    payouts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    email_notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    telegram_notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    email_notification_events_json: Mapped[str] = mapped_column(
        String(4000), nullable=False, default="[]"
    )
    telegram_notification_events_json: Mapped[str] = mapped_column(
        String(4000), nullable=False, default="[]"
    )
    notification_templates_json: Mapped[str] = mapped_column(
        String(16000), nullable=False, default="{}"
    )
    notification_brand_name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="NorenCash"
    )
    notification_logo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    notification_primary_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    smtp_bz_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    smtp_bz_api_base_url: Mapped[str] = mapped_column(
        String(255), nullable=False, default="https://api.smtp.bz/v1"
    )
    smtp_bz_api_key_encrypted: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    smtp_bz_sender_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    smtp_bz_sender_name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="NorenCash"
    )
    smtp_bz_reply_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_bz_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    telegram_api_base_url: Mapped[str] = mapped_column(
        String(255), nullable=False, default="https://api.telegram.org"
    )
    telegram_bot_token_encrypted: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
    )
