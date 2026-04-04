"""rbac and 2fa support

Revision ID: 20260329_0002
Revises: 20260328_0001
Create Date: 2026-03-29 11:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260329_0002"
down_revision = "20260328_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("users", sa.Column("totp_secret_encrypted", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("totp_confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("users", "totp_enabled", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "totp_confirmed_at")
    op.drop_column("users", "totp_secret_encrypted")
    op.drop_column("users", "totp_enabled")
