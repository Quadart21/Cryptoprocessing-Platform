"""balance hold after payment

Revision ID: 20260604_0001
Revises: 20260531_0002
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20260604_0001"
down_revision = "20260531_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_balances",
        sa.Column(
            "frozen_amount",
            sa.Numeric(precision=18, scale=8),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_tenant_balance_frozen_amount_positive",
        "tenant_balances",
        "frozen_amount >= 0",
    )
    op.add_column(
        "transactions",
        sa.Column("balance_available_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("balance_released_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_transactions_balance_available_at",
        "transactions",
        ["balance_available_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_balance_available_at", table_name="transactions")
    op.drop_column("transactions", "balance_released_at")
    op.drop_column("transactions", "balance_available_at")
    op.drop_constraint("ck_tenant_balance_frozen_amount_positive", "tenant_balances", type_="check")
    op.drop_column("tenant_balances", "frozen_amount")
