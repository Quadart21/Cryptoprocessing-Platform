"""project checkout_delivery

Revision ID: 20260531_0002
Revises: 20260531_0001
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa

revision = "20260531_0002"
down_revision = "20260531_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "checkout_delivery",
            sa.String(length=32),
            nullable=False,
            server_default="both",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "checkout_delivery")
