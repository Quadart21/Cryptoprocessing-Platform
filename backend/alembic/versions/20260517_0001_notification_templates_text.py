"""notification templates text storage

Revision ID: 20260517_0001
Revises: 20260509_0002
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260517_0001"
down_revision = "20260509_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE platform_settings
            ALTER COLUMN notification_templates_json TYPE TEXT
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE platform_settings
            ALTER COLUMN notification_templates_json TYPE VARCHAR(16000)
            """
        )
    )
