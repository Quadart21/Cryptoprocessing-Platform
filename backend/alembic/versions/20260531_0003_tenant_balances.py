"""create tenant_balances table

Revision ID: 20260531_0003
Revises: 20260531_0002
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa

revision = "20260531_0003"
down_revision = "20260531_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_balances",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("currency", sa.String(length=20), nullable=False),
        sa.Column("available_amount", sa.Numeric(precision=18, scale=8), nullable=False, server_default="0"),
        sa.Column("pending_amount", sa.Numeric(precision=18, scale=8), nullable=False, server_default="0"),
        sa.Column("locked_amount", sa.Numeric(precision=18, scale=8), nullable=False, server_default="0"),
        sa.Column("withdrawn_amount", sa.Numeric(precision=18, scale=8), nullable=False, server_default="0"),
        sa.Column("provider_gross_amount", sa.Numeric(precision=18, scale=8), nullable=False, server_default="0"),
        sa.Column("updated_balance_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("available_amount >= 0", name="ck_tenant_balance_available_amount_positive"),
        sa.CheckConstraint("pending_amount >= 0", name="ck_tenant_balance_pending_amount_positive"),
        sa.CheckConstraint("locked_amount >= 0", name="ck_tenant_balance_locked_amount_positive"),
        sa.CheckConstraint("withdrawn_amount >= 0", name="ck_tenant_balance_withdrawn_amount_positive"),
        sa.CheckConstraint(
            "provider_gross_amount >= 0",
            name="ck_tenant_balance_provider_gross_amount_positive",
        ),
    )
    op.create_index(op.f("ix_tenant_balances_tenant_id"), "tenant_balances", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_tenant_balances_currency"), "tenant_balances", ["currency"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tenant_balances_currency"), table_name="tenant_balances")
    op.drop_index(op.f("ix_tenant_balances_tenant_id"), table_name="tenant_balances")
    op.drop_table("tenant_balances")
