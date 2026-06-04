"""add platform_fee_min_usdt to platform_settings

Revision ID: 20260604_0002
Revises: 20260604_0001
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20260604_0002"
down_revision = "20260604_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS platform_fee_min_usdt NUMERIC(18, 8) NOT NULL DEFAULT 0.2
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE platform_settings
        DROP COLUMN IF EXISTS platform_fee_min_usdt
        """
    )
