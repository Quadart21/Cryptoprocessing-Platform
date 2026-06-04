"""checkout_delivery default payment_page

Revision ID: 20260604_0003
Revises: 20260604_0002
Create Date: 2026-06-04
"""

from alembic import op

revision = "20260604_0003"
down_revision = "20260604_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE projects
        SET checkout_delivery = 'payment_page'
        WHERE checkout_delivery = 'both'
        """
    )
    op.execute(
        """
        ALTER TABLE projects
        ALTER COLUMN checkout_delivery SET DEFAULT 'payment_page'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE projects
        ALTER COLUMN checkout_delivery SET DEFAULT 'both'
        """
    )
