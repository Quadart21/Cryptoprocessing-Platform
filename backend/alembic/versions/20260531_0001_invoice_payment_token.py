"""invoice payment_token for public pay page

Revision ID: 20260531_0001
Revises: 20260530_0001
Create Date: 2026-05-31
"""

import secrets

from alembic import op
import sqlalchemy as sa


revision = "20260531_0001"
down_revision = "20260530_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("payment_token", sa.String(length=64), nullable=True))
    op.create_index("ix_invoices_payment_token", "invoices", ["payment_token"], unique=True)

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM invoices WHERE payment_token IS NULL")).fetchall()
    for (invoice_id,) in rows:
        token = secrets.token_urlsafe(32)
        connection.execute(
            sa.text("UPDATE invoices SET payment_token = :token WHERE id = :id"),
            {"token": token, "id": invoice_id},
        )


def downgrade() -> None:
    op.drop_index("ix_invoices_payment_token", table_name="invoices")
    op.drop_column("invoices", "payment_token")
