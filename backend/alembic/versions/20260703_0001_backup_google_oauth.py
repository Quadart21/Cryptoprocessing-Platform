"""backup settings google oauth refresh token

Revision ID: 20260703_0001
Revises: 20260611_0002
Create Date: 2026-07-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260703_0001"
down_revision = "20260611_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("backup_settings"):
        return

    op.add_column(
        "backup_settings",
        sa.Column("google_oauth_refresh_token_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "backup_settings",
        sa.Column("google_oauth_user_email", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("backup_settings"):
        return

    op.drop_column("backup_settings", "google_oauth_user_email")
    op.drop_column("backup_settings", "google_oauth_refresh_token_encrypted")
