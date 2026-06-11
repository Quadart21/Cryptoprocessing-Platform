"""platform backups settings and jobs

Revision ID: 20260611_0001
Revises: 20260604_0003
Create Date: 2026-06-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260611_0001"
down_revision = "20260604_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if not inspect(bind).has_table("backup_settings"):
        op.create_table(
            "backup_settings",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("code", sa.String(length=100), nullable=False),
            sa.Column("google_drive_folder_id", sa.String(length=255), nullable=True),
            sa.Column("google_service_account_json_encrypted", sa.Text(), nullable=True),
            sa.Column("upload_to_drive_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("schedule_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("schedule_frequency", sa.String(length=32), server_default="daily", nullable=False),
            sa.Column("schedule_hour_utc", sa.Integer(), server_default="3", nullable=False),
            sa.Column("schedule_weekday", sa.Integer(), server_default="0", nullable=False),
            sa.Column(
                "schedule_scopes_json",
                sa.String(length=500),
                server_default='["full"]',
                nullable=False,
            ),
            sa.Column("local_retention_count", sa.Integer(), server_default="5", nullable=False),
            sa.Column("last_scheduled_run_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_backup_settings_code"), "backup_settings", ["code"], unique=True)

    if not inspect(bind).has_table("backup_jobs"):
        op.create_table(
            "backup_jobs",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("scope", sa.String(length=32), nullable=False),
            sa.Column("trigger", sa.String(length=32), server_default="manual", nullable=False),
            sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
            sa.Column("file_name", sa.String(length=255), nullable=True),
            sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
            sa.Column("local_path", sa.String(length=1000), nullable=True),
            sa.Column("google_drive_file_id", sa.String(length=255), nullable=True),
            sa.Column("google_drive_url", sa.String(length=1000), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("initiated_by_user_id", sa.UUID(), nullable=True),
            sa.ForeignKeyConstraint(["initiated_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_backup_jobs_scope"), "backup_jobs", ["scope"], unique=False)
        op.create_index(op.f("ix_backup_jobs_status"), "backup_jobs", ["status"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO backup_settings (id, code)
            SELECT '00000000-0000-4000-8000-000000000001'::uuid, 'default'
            WHERE NOT EXISTS (SELECT 1 FROM backup_settings WHERE code = 'default')
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()

    if inspect(bind).has_table("backup_jobs"):
        op.drop_index(op.f("ix_backup_jobs_status"), table_name="backup_jobs")
        op.drop_index(op.f("ix_backup_jobs_scope"), table_name="backup_jobs")
        op.drop_table("backup_jobs")

    if inspect(bind).has_table("backup_settings"):
        op.drop_index(op.f("ix_backup_settings_code"), table_name="backup_settings")
        op.drop_table("backup_settings")
