import logging
from sqlalchemy import text

from app.core.security import encrypt_value
from app.db.session import engine
from app.models import Base
from app.services.key_service import KeyService

logger = logging.getLogger(__name__)

# Lightweight schema patches for environments where we don't run full Alembic yet.
# Idempotent by design.
DDL_PATCHES = [
    # public pages
    """
    CREATE TABLE IF NOT EXISTS public_pages (
        id UUID PRIMARY KEY,
        slug VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content_html TEXT NOT NULL DEFAULT '',
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        show_in_header BOOLEAN NOT NULL DEFAULT FALSE,
        show_in_footer BOOLEAN NOT NULL DEFAULT FALSE,
        header_order INTEGER NOT NULL DEFAULT 0,
        footer_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ix_public_pages_slug
    ON public_pages (slug)
    """,
    # tenants
    """
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS review_comment VARCHAR(500)
    """,
    """
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NOT NULL DEFAULT 'UTC'
    """,
    """
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) NOT NULL DEFAULT 'USD'
    """,
    """
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'default'
    """,
    # projects
    """
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS description VARCHAR(1000)
    """,
    """
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500)
    """,
    """
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS webhook_secret_hash VARCHAR(255)
    """,
    """
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS webhook_secret_encrypted VARCHAR(1024)
    """,
    """
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending_review'
    """,
    # api_keys
    """
    ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
    """,
    """
    ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ
    """,
    # invoices
    """
    ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ
    """,
    """
    ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ
    """,
    """
    ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS metadata_json JSON
    """,
    """
    ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS raw_provider_payload_json JSON
    """,
    # transactions
    """
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS provider_fee NUMERIC(18, 8) NOT NULL DEFAULT 0
    """,
    """
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(18, 8) NOT NULL DEFAULT 0
    """,
    """
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS turnover_fee NUMERIC(18, 8) NOT NULL DEFAULT 0
    """,
    """
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS net_amount NUMERIC(18, 8) NOT NULL DEFAULT 0
    """,
    # billing settings
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS default_turnover_fee_percent NUMERIC(10, 4) NOT NULL DEFAULT 0.0000
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS allow_tenant_turnover_fee_override BOOLEAN NOT NULL DEFAULT TRUE
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS email_notification_events_json VARCHAR(4000) NOT NULL DEFAULT '[]'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS telegram_notification_events_json VARCHAR(4000) NOT NULL DEFAULT '[]'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS notification_templates_json VARCHAR(16000) NOT NULL DEFAULT '{}'
    """,
    """
    ALTER TABLE platform_settings
    ALTER COLUMN notification_templates_json TYPE TEXT
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS notification_brand_name VARCHAR(255) NOT NULL DEFAULT 'NorenCash'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS notification_logo_url VARCHAR(1000)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS notification_primary_url VARCHAR(1000)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS smtp_bz_enabled BOOLEAN NOT NULL DEFAULT FALSE
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS smtp_bz_api_base_url VARCHAR(255) NOT NULL DEFAULT 'https://api.smtp.bz/v1'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS smtp_bz_api_key_encrypted VARCHAR(1024)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS smtp_bz_sender_email VARCHAR(255) NOT NULL DEFAULT ''
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS smtp_bz_sender_name VARCHAR(255) NOT NULL DEFAULT 'NorenCash'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS smtp_bz_reply_to VARCHAR(255)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS smtp_bz_tag VARCHAR(100)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS telegram_api_base_url VARCHAR(255) NOT NULL DEFAULT 'https://api.telegram.org'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS telegram_bot_token_encrypted VARCHAR(1024)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS seo_description VARCHAR(500)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS seo_keywords VARCHAR(500)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS seo_favicon_url VARCHAR(1000)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS seo_og_image_url VARCHAR(1000)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS seo_robots VARCHAR(100) NOT NULL DEFAULT 'index, follow'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS seo_canonical_url VARCHAR(500)
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS exchange_rate_markup_percent NUMERIC(10, 4) NOT NULL DEFAULT 0.0000
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS manual_exchange_rates_json VARCHAR(16000) NOT NULL DEFAULT '{}'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS cached_exchange_rates_json VARCHAR(16000) NOT NULL DEFAULT '{}'
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS cached_exchange_rates_updated_at TIMESTAMPTZ
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS platform_markup_min_usdt NUMERIC(18, 8) NOT NULL DEFAULT 0.5
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS platform_markup_min_band_usdt_low NUMERIC(18, 8) NOT NULL DEFAULT 10
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS platform_markup_min_band_usdt_high NUMERIC(18, 8) NOT NULL DEFAULT 250
    """,
    """
    ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS sandbox_cloudflare_api_token_encrypted VARCHAR(2048)
    """,
    """
    ALTER TABLE tenant_fee_policies
    ADD COLUMN IF NOT EXISTS custom_turnover_fee_percent NUMERIC(10, 4)
    """,
    # payout requests
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS destination_address VARCHAR(255)
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS network VARCHAR(50) NOT NULL DEFAULT 'TRC20'
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS currency VARCHAR(20) NOT NULL DEFAULT 'USDT'
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS amount_requested NUMERIC(18, 8) NOT NULL DEFAULT 0
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS amount_approved NUMERIC(18, 8)
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending_review'
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS external_payout_id VARCHAR(255)
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS review_comment VARCHAR(500)
    """,
    """
    ALTER TABLE payout_requests
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ
    """,
    # users / auth
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS totp_secret_encrypted VARCHAR(255)
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS totp_confirmed_at TIMESTAMPTZ
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_email_enabled BOOLEAN NOT NULL DEFAULT TRUE
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64)
    """,
]

RLS_TENANT_TABLES = [
    "projects",
    "api_keys",
    "invoices",
    "transactions",
    "ledger_entries",
    "payout_requests",
    "tenant_balances",
    "tenant_fee_policies",
]


def ensure_database_ready() -> None:
    logger.info("Running database readiness check and lightweight schema sync.")
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(
            text("SELECT set_config('app.is_superadmin', 'on', true)")
        )
        connection.execute(
            text("SELECT set_config('app.tenant_id', '', true)")
        )
        for ddl in DDL_PATCHES:
            connection.execute(text(ddl))
        _migrate_plaintext_webhook_secrets(connection)
        _ensure_provider_event_uniqueness(connection)
        _apply_rls_policies(connection)
    logger.info("Database readiness check completed.")


def _migrate_plaintext_webhook_secrets(connection) -> None:
    has_legacy_column = bool(
        connection.scalar(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'projects'
                  AND column_name = 'webhook_secret_value'
                LIMIT 1
                """
            )
        )
    )
    if not has_legacy_column:
        return

    rows = connection.execute(
        text(
            """
            SELECT id, webhook_secret_value
            FROM projects
            WHERE webhook_secret_value IS NOT NULL
              AND webhook_secret_value <> ''
              AND (webhook_secret_encrypted IS NULL OR webhook_secret_encrypted = '')
            """
        )
    ).all()

    for row in rows:
        secret_raw = str(row.webhook_secret_value).strip()
        if not secret_raw:
            continue
        connection.execute(
            text(
                """
                UPDATE projects
                SET webhook_secret_encrypted = :encrypted,
                    webhook_secret_hash = :secret_hash,
                    webhook_secret_value = NULL
                WHERE id = :project_id
                """
            ),
            {
                "project_id": row.id,
                "encrypted": encrypt_value(secret_raw),
                "secret_hash": KeyService.hash_secret(secret_raw),
            },
        )


def _ensure_provider_event_uniqueness(connection) -> None:
    # Keep the newest row per (provider_name, provider_event_id) before applying unique index.
    connection.execute(
        text(
            """
            DELETE FROM provider_events
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY provider_name, provider_event_id
                            ORDER BY created_at DESC, id DESC
                        ) AS rn
                    FROM provider_events
                ) duplicated
                WHERE duplicated.rn > 1
            )
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ux_provider_events_provider_event_id
            ON provider_events (provider_name, provider_event_id)
            """
        )
    )


def _apply_rls_policies(connection) -> None:
    for table in RLS_TENANT_TABLES:
        policy_name = f"{table}_tenant_isolation"
        connection.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        connection.execute(text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        connection.execute(text(f"DROP POLICY IF EXISTS {policy_name} ON {table}"))
        connection.execute(
            text(
                f"""
                CREATE POLICY {policy_name}
                ON {table}
                USING (
                    current_setting('app.is_superadmin', true) = 'on'
                    OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
                )
                WITH CHECK (
                    current_setting('app.is_superadmin', true) = 'on'
                    OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
                )
                """
            )
        )
