"""platform backups settings and jobs

Revision ID: 20260611_0001
Revises: 20260604_0003
Create Date: 2026-06-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260611_0001"
down_revision = "20260604_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS backup_settings (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                code VARCHAR(100) NOT NULL,
                google_drive_folder_id VARCHAR(255),
                google_service_account_json_encrypted TEXT,
                upload_to_drive_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                schedule_frequency VARCHAR(32) NOT NULL DEFAULT 'daily',
                schedule_hour_utc INTEGER NOT NULL DEFAULT 3,
                schedule_weekday INTEGER NOT NULL DEFAULT 0,
                schedule_scopes_json VARCHAR(500) NOT NULL DEFAULT '["full"]',
                local_retention_count INTEGER NOT NULL DEFAULT 5,
                last_scheduled_run_at TIMESTAMPTZ
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ix_backup_settings_code
            ON backup_settings (code)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS backup_jobs (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                scope VARCHAR(32) NOT NULL,
                trigger VARCHAR(32) NOT NULL DEFAULT 'manual',
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                file_name VARCHAR(255),
                file_size_bytes BIGINT,
                local_path VARCHAR(1000),
                google_drive_file_id VARCHAR(255),
                google_drive_url VARCHAR(1000),
                error_message TEXT,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                initiated_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_backup_jobs_scope
            ON backup_jobs (scope)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_backup_jobs_status
            ON backup_jobs (status)
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO backup_settings (id, code)
            SELECT '00000000-0000-4000-8000-000000000001', 'default'
            WHERE NOT EXISTS (SELECT 1 FROM backup_settings WHERE code = 'default')
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS backup_jobs"))
    op.execute(sa.text("DROP TABLE IF EXISTS backup_settings"))
