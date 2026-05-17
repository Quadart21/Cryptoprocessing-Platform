"""sandbox cloudflare token + agent_public_id

Revision ID: 20260509_0002
Revises: 20260509_0001
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0002"
down_revision = "20260509_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Идемпотентно: колонки могли быть добавлены вручную или частичным прогоном.
    op.execute(
        sa.text(
            """
            ALTER TABLE platform_settings
            ADD COLUMN IF NOT EXISTS sandbox_cloudflare_api_token_encrypted VARCHAR(2048)
            """
        )
    )
    op.execute(
        sa.text(
            """
            ALTER TABLE merchant_sandboxes
            ADD COLUMN IF NOT EXISTS agent_public_id VARCHAR(32)
            """
        )
    )
    op.execute(
        sa.text(
            """
            ALTER TABLE merchant_sandboxes
            ADD COLUMN IF NOT EXISTS origin_ipv4 VARCHAR(45)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ix_merchant_sandboxes_agent_public_id
            ON merchant_sandboxes (agent_public_id)
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_merchant_sandboxes_agent_public_id"))
    op.drop_column("merchant_sandboxes", "origin_ipv4")
    op.drop_column("merchant_sandboxes", "agent_public_id")
    op.drop_column("platform_settings", "sandbox_cloudflare_api_token_encrypted")
