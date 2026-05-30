"""create platform_settings table

Revision ID: 20260407_0001
Revises: 20260329_0002
Create Date: 2026-04-07 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260407_0001"
down_revision = "20260329_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("platform_settings"):
        return

    op.create_table(
        "platform_settings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("provider_fee_percent", sa.Numeric(10, 4), nullable=False, server_default="0.2000"),
        sa.Column("default_markup_percent", sa.Numeric(10, 4), nullable=False, server_default="0.0000"),
        sa.Column("default_turnover_fee_percent", sa.Numeric(10, 4), nullable=False, server_default="0.0000"),
        sa.Column("allow_tenant_markup_override", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("allow_tenant_turnover_fee_override", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("payouts_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("telegram_notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_notification_events_json", sa.String(length=4000), nullable=False, server_default="[]"),
        sa.Column("telegram_notification_events_json", sa.String(length=4000), nullable=False, server_default="[]"),
        sa.Column("notification_templates_json", sa.String(length=16000), nullable=False, server_default="{}"),
        sa.Column("notification_brand_name", sa.String(length=255), nullable=False, server_default="NorenCash"),
        sa.Column("notification_logo_url", sa.String(length=1000), nullable=True),
        sa.Column("notification_primary_url", sa.String(length=1000), nullable=True),
        sa.Column("smtp_bz_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("smtp_bz_api_base_url", sa.String(length=255), nullable=False, server_default="https://api.smtp.bz/v1"),
        sa.Column("smtp_bz_api_key_encrypted", sa.String(length=1024), nullable=True),
        sa.Column("smtp_bz_sender_email", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("smtp_bz_sender_name", sa.String(length=255), nullable=False, server_default="NorenCash"),
        sa.Column("smtp_bz_reply_to", sa.String(length=255), nullable=True),
        sa.Column("smtp_bz_tag", sa.String(length=100), nullable=True),
        sa.Column("telegram_api_base_url", sa.String(length=255), nullable=False, server_default="https://api.telegram.org"),
        sa.Column("telegram_bot_token_encrypted", sa.String(length=1024), nullable=True),
        sa.Column("seo_title", sa.String(length=255), nullable=True),
        sa.Column("seo_description", sa.String(length=500), nullable=True),
        sa.Column("seo_keywords", sa.String(length=500), nullable=True),
        sa.Column("seo_favicon_url", sa.String(length=1000), nullable=True),
        sa.Column("seo_og_image_url", sa.String(length=1000), nullable=True),
        sa.Column("seo_robots", sa.String(length=100), nullable=False, server_default="index, follow"),
        sa.Column("seo_canonical_url", sa.String(length=500), nullable=True),
        sa.Column("manual_exchange_rates_json", sa.String(length=16000), nullable=False, server_default="{}"),
        sa.Column("cached_exchange_rates_json", sa.String(length=16000), nullable=False, server_default="{}"),
        sa.Column("cached_exchange_rates_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("platform_markup_min_usdt", sa.Numeric(18, 8), nullable=False, server_default="0.5"),
        sa.Column("platform_markup_min_band_usdt_low", sa.Numeric(18, 8), nullable=False, server_default="10"),
        sa.Column("platform_markup_min_band_usdt_high", sa.Numeric(18, 8), nullable=False, server_default="250"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_platform_settings_code"), "platform_settings", ["code"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("platform_settings"):
        return
    op.drop_index(op.f("ix_platform_settings_code"), table_name="platform_settings")
    op.drop_table("platform_settings")
