"""add exchange_rate_markup_percent to platform_settings

Revision ID: 20260408_0001
Revises: 20260329_0002
Create Date: 2026-04-08 02:30:00
"""

from alembic import op
import sqlalchemy as sa
from decimal import Decimal


revision = "20260408_0001"
down_revision = "20260329_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Идемпотентно: колонка могла появиться до этой ревизии (ручной патч / другой процесс).
    op.execute(
        sa.text(
            """
            ALTER TABLE platform_settings
            ADD COLUMN IF NOT EXISTS exchange_rate_markup_percent NUMERIC(10, 4) NOT NULL DEFAULT 0.0000
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            'ALTER TABLE platform_settings DROP COLUMN IF EXISTS "exchange_rate_markup_percent"'
        )
    )