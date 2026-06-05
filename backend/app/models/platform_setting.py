from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PlatformSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "platform_settings"

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    provider_fee_percent: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("1.0000")
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
        String(4000), nullable=False, default='["application_approved", "application_rejected", "application_submitted", "password_generated", "password_changed", "api_key_generated", "api_key_regenerated", "api_key_revoked", "two_factor_enabled", "two_factor_disabled", "payout_requested", "payout_approved", "payout_rejected"]'
    )
    telegram_notification_events_json: Mapped[str] = mapped_column(
        String(4000), nullable=False, default='["application_approved", "application_rejected", "application_submitted", "password_generated", "password_changed", "api_key_generated", "api_key_regenerated", "api_key_revoked", "two_factor_enabled", "two_factor_disabled", "payout_requested", "payout_approved", "payout_rejected"]'
    )
    notification_templates_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="{}"
    )
    notification_brand_name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="NorenDigital"
    )
    notification_logo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    notification_primary_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    smtp_bz_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    smtp_bz_api_base_url: Mapped[str] = mapped_column(
        String(255), nullable=False, default="https://api.smtp.bz/v1"
    )
    smtp_bz_api_key_encrypted: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    smtp_bz_sender_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    smtp_bz_sender_name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="NorenDigital"
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
    seo_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    seo_keywords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    seo_favicon_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    seo_og_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    seo_robots: Mapped[str] = mapped_column(String(100), nullable=False, default="index, follow")
    seo_canonical_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    exchange_rate_markup_percent: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=Decimal("0.0000")
    )
    exchange_rate_price_field: Mapped[str] = mapped_column(
        String(20), nullable=False, default="last"
    )
    manual_exchange_rates_json: Mapped[str] = mapped_column(
        String(16000), nullable=False, default="{}"
    )
    cached_exchange_rates_json: Mapped[str] = mapped_column(
        String(16000), nullable=False, default="{}"
    )
    cached_exchange_rates_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # Минимум комиссии провайдера в USDT (если % от gross меньше).
    platform_markup_min_usdt: Mapped[Decimal] = mapped_column(
        Numeric(18, 8), nullable=False, default=Decimal("0.55")
    )
    # Фикс комиссии платформы, когда у провайдера сработал минимум (не %).
    platform_fee_min_usdt: Mapped[Decimal] = mapped_column(
        Numeric(18, 8), nullable=False, default=Decimal("0.2")
    )
    platform_markup_min_band_usdt_low: Mapped[Decimal] = mapped_column(
        Numeric(18, 8), nullable=False, default=Decimal("10")
    )
    platform_markup_min_band_usdt_high: Mapped[Decimal] = mapped_column(
        Numeric(18, 8), nullable=False, default=Decimal("250")
    )
    sandbox_cloudflare_api_token_encrypted: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True,
    )
    ops_telegram_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ops_telegram_chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ops_telegram_topics_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    ops_telegram_events_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default='["application_submitted","application_approved","application_rejected","payout_requested","payout_approved","payout_rejected","invoice_paid","invoice_confirmed","provider_alert","tenant_password_reset","tenant_2fa_reset","sandbox_created","sandbox_ready","daily_report"]',
    )
