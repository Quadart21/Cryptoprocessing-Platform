"""affiliate settings json ultra-wide config

Revision ID: 20260714_0002
Revises: 20260714_0001
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260714_0002"
down_revision = "20260714_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "platform_settings" not in inspector.get_table_names():
        return
    cols = {col["name"] for col in inspector.get_columns("platform_settings")}
    if "affiliate_settings_json" not in cols:
        op.add_column(
            "platform_settings",
            sa.Column("affiliate_settings_json", sa.Text(), nullable=False, server_default="{}"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "platform_settings" not in inspector.get_table_names():
        return
    cols = {col["name"] for col in inspector.get_columns("platform_settings")}
    if "affiliate_settings_json" in cols:
        op.drop_column("platform_settings", "affiliate_settings_json")
