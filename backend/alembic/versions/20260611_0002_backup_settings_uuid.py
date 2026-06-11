"""fix backup_settings id column type after partial deploy

Revision ID: 20260611_0002
Revises: 20260611_0001
Create Date: 2026-06-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260611_0002"
down_revision = "20260611_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First deploy used VARCHAR(36) for backup_settings.id before backup_jobs failed.
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'backup_settings'
                      AND column_name = 'id'
                      AND data_type = 'character varying'
                ) THEN
                    ALTER TABLE backup_settings
                    ALTER COLUMN id TYPE UUID USING id::uuid;
                END IF;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE backup_settings
            ALTER COLUMN id TYPE VARCHAR(36) USING id::text
            """
        )
    )
