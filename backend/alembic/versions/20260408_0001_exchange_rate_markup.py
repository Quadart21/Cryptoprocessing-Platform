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
    op.add_column(
        "platform_settings",
        sa.Column(
            "exchange_rate_markup_percent",
            sa.Numeric(10, 4),
            nullable=False,
            server_default=sa.text("0.0000"),
        ),
    )


def downgrade() -> None:
    op.drop_column("platform_settings", "exchange_rate_markup_percent")