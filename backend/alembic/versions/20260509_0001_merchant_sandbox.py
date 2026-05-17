"""merchant sandbox, statistics exclusion, audit

Revision ID: 20260509_0001
Revises: 20260408_0001
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260509_0001"
down_revision = "20260408_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if not inspect(bind).has_table("merchant_sandboxes"):
        op.create_table(
            "merchant_sandboxes",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("tenant_id", sa.UUID(), nullable=False),
            sa.Column("project_id", sa.UUID(), nullable=True),
            sa.Column("label", sa.String(length=255), nullable=False),
            sa.Column("dns_parent_zone", sa.String(length=255), nullable=False),
            sa.Column("desired_subdomain", sa.String(length=63), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False),
            sa.Column("enrollment_token_hash", sa.String(length=128), nullable=True),
            sa.Column("enrollment_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("agent_token_hash", sa.String(length=128), nullable=True),
            sa.Column("agent_instance_id", sa.String(length=128), nullable=True),
            sa.Column("cloudflare_zone_id", sa.String(length=64), nullable=True),
            sa.Column("cloudflare_dns_record_id", sa.String(length=64), nullable=True),
            sa.Column("public_base_url", sa.String(length=500), nullable=True),
            sa.Column("created_by_user_id", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_merchant_sandboxes_agent_instance_id"), "merchant_sandboxes", ["agent_instance_id"], unique=False)
        op.create_index(op.f("ix_merchant_sandboxes_created_by_user_id"), "merchant_sandboxes", ["created_by_user_id"], unique=False)
        op.create_index(op.f("ix_merchant_sandboxes_enrollment_token_hash"), "merchant_sandboxes", ["enrollment_token_hash"], unique=False)
        op.create_index(op.f("ix_merchant_sandboxes_project_id"), "merchant_sandboxes", ["project_id"], unique=False)
        op.create_index(op.f("ix_merchant_sandboxes_status"), "merchant_sandboxes", ["status"], unique=False)
        op.create_index(op.f("ix_merchant_sandboxes_tenant_id"), "merchant_sandboxes", ["tenant_id"], unique=True)
        op.create_unique_constraint(
            "uq_merchant_sandboxes_zone_subdomain",
            "merchant_sandboxes",
            ["dns_parent_zone", "desired_subdomain"],
        )

    if not inspect(bind).has_table("statistics_exclusions"):
        op.create_table(
            "statistics_exclusions",
            sa.Column("tenant_id", sa.UUID(), nullable=False),
            sa.Column("reason", sa.String(length=64), nullable=False),
            sa.Column("merchant_sandbox_id", sa.UUID(), nullable=True),
            sa.ForeignKeyConstraint(["merchant_sandbox_id"], ["merchant_sandboxes.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("tenant_id"),
        )
        op.create_index(op.f("ix_statistics_exclusions_merchant_sandbox_id"), "statistics_exclusions", ["merchant_sandbox_id"], unique=False)
        op.create_index(op.f("ix_statistics_exclusions_reason"), "statistics_exclusions", ["reason"], unique=False)

    if not inspect(bind).has_table("sandbox_audit_logs"):
        op.create_table(
            "sandbox_audit_logs",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("merchant_sandbox_id", sa.UUID(), nullable=False),
            sa.Column("admin_user_id", sa.UUID(), nullable=True),
            sa.Column("action", sa.String(length=80), nullable=False),
            sa.Column("payload_json", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["admin_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["merchant_sandbox_id"], ["merchant_sandboxes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_sandbox_audit_logs_action"), "sandbox_audit_logs", ["action"], unique=False)
        op.create_index(op.f("ix_sandbox_audit_logs_admin_user_id"), "sandbox_audit_logs", ["admin_user_id"], unique=False)
        op.create_index(op.f("ix_sandbox_audit_logs_created_at"), "sandbox_audit_logs", ["created_at"], unique=False)
        op.create_index(op.f("ix_sandbox_audit_logs_merchant_sandbox_id"), "sandbox_audit_logs", ["merchant_sandbox_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    if inspect(bind).has_table("sandbox_audit_logs"):
        op.drop_index(op.f("ix_sandbox_audit_logs_merchant_sandbox_id"), table_name="sandbox_audit_logs")
        op.drop_index(op.f("ix_sandbox_audit_logs_created_at"), table_name="sandbox_audit_logs")
        op.drop_index(op.f("ix_sandbox_audit_logs_admin_user_id"), table_name="sandbox_audit_logs")
        op.drop_index(op.f("ix_sandbox_audit_logs_action"), table_name="sandbox_audit_logs")
        op.drop_table("sandbox_audit_logs")

    if inspect(bind).has_table("statistics_exclusions"):
        op.drop_index(op.f("ix_statistics_exclusions_reason"), table_name="statistics_exclusions")
        op.drop_index(op.f("ix_statistics_exclusions_merchant_sandbox_id"), table_name="statistics_exclusions")
        op.drop_table("statistics_exclusions")

    if inspect(bind).has_table("merchant_sandboxes"):
        op.drop_constraint("uq_merchant_sandboxes_zone_subdomain", "merchant_sandboxes", type_="unique")
        op.drop_index(op.f("ix_merchant_sandboxes_tenant_id"), table_name="merchant_sandboxes")
        op.drop_index(op.f("ix_merchant_sandboxes_status"), table_name="merchant_sandboxes")
        op.drop_index(op.f("ix_merchant_sandboxes_project_id"), table_name="merchant_sandboxes")
        op.drop_index(op.f("ix_merchant_sandboxes_enrollment_token_hash"), table_name="merchant_sandboxes")
        op.drop_index(op.f("ix_merchant_sandboxes_created_by_user_id"), table_name="merchant_sandboxes")
        op.drop_index(op.f("ix_merchant_sandboxes_agent_instance_id"), table_name="merchant_sandboxes")
        op.drop_table("merchant_sandboxes")
