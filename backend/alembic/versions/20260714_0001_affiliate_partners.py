"""affiliate partner program tables and settings

Revision ID: 20260714_0001
Revises: 20260703_0001
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260714_0001"
down_revision = "20260703_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "partners" not in tables:
        op.create_table(
            "partners",
            sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
            sa.Column("user_id", sa.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("referral_code", sa.String(length=32), nullable=False),
            sa.Column("display_name", sa.String(length=255), nullable=False),
            sa.Column("contact_telegram", sa.String(length=100), nullable=True),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
            sa.Column("commission_percent", sa.Numeric(10, 4), nullable=True),
            sa.Column("payout_address", sa.String(length=255), nullable=True),
            sa.Column("payout_network", sa.String(length=50), nullable=False, server_default="TRC20"),
            sa.Column("review_comment", sa.String(length=500), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("user_id", name="uq_partners_user_id"),
            sa.UniqueConstraint("referral_code", name="uq_partners_referral_code"),
        )
        op.create_index("ix_partners_user_id", "partners", ["user_id"])
        op.create_index("ix_partners_referral_code", "partners", ["referral_code"])

    if "partner_payout_requests" not in tables:
        op.create_table(
            "partner_payout_requests",
            sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
            sa.Column("partner_id", sa.UUID(as_uuid=False), sa.ForeignKey("partners.id"), nullable=False),
            sa.Column("requested_by_user_id", sa.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("reviewed_by_user_id", sa.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("destination_address", sa.String(length=255), nullable=False),
            sa.Column("network", sa.String(length=50), nullable=False, server_default="TRC20"),
            sa.Column("currency", sa.String(length=20), nullable=False, server_default="USDT"),
            sa.Column("amount_requested", sa.Numeric(18, 8), nullable=False),
            sa.Column("amount_approved", sa.Numeric(18, 8), nullable=True),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending_review"),
            sa.Column("review_comment", sa.String(length=500), nullable=True),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("external_reference", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_partner_payout_requests_partner_id", "partner_payout_requests", ["partner_id"])

    if "partner_referral_events" not in tables:
        op.create_table(
            "partner_referral_events",
            sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
            sa.Column("partner_id", sa.UUID(as_uuid=False), sa.ForeignKey("partners.id"), nullable=False),
            sa.Column("event_type", sa.String(length=50), nullable=False, server_default="click"),
            sa.Column("referral_code", sa.String(length=32), nullable=False),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column("landing_path", sa.String(length=500), nullable=True),
            sa.Column("tenant_id", sa.UUID(as_uuid=False), sa.ForeignKey("tenants.id"), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_partner_referral_events_partner_id", "partner_referral_events", ["partner_id"])
        op.create_index("ix_partner_referral_events_referral_code", "partner_referral_events", ["referral_code"])

    if "partner_commissions" not in tables:
        op.create_table(
            "partner_commissions",
            sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
            sa.Column("partner_id", sa.UUID(as_uuid=False), sa.ForeignKey("partners.id"), nullable=False),
            sa.Column("tenant_id", sa.UUID(as_uuid=False), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("invoice_id", sa.UUID(as_uuid=False), sa.ForeignKey("invoices.id"), nullable=False),
            sa.Column("transaction_id", sa.UUID(as_uuid=False), sa.ForeignKey("transactions.id"), nullable=False),
            sa.Column("platform_fee_amount", sa.Numeric(18, 8), nullable=False),
            sa.Column("commission_percent", sa.Numeric(10, 4), nullable=False),
            sa.Column("commission_amount", sa.Numeric(18, 8), nullable=False),
            sa.Column("currency", sa.String(length=20), nullable=False, server_default="USDT"),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending_hold"),
            sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "payout_request_id",
                sa.UUID(as_uuid=False),
                sa.ForeignKey("partner_payout_requests.id"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("transaction_id", name="uq_partner_commissions_transaction"),
        )
        op.create_index("ix_partner_commissions_partner_id", "partner_commissions", ["partner_id"])
        op.create_index("ix_partner_commissions_tenant_id", "partner_commissions", ["tenant_id"])

    if "tenants" in tables:
        tenant_cols = {col["name"] for col in inspector.get_columns("tenants")}
        if "referral_partner_id" not in tenant_cols:
            op.add_column(
                "tenants",
                sa.Column(
                    "referral_partner_id",
                    sa.UUID(as_uuid=False),
                    sa.ForeignKey("partners.id"),
                    nullable=True,
                ),
            )
            op.create_index("ix_tenants_referral_partner_id", "tenants", ["referral_partner_id"])

    if "platform_settings" in tables:
        settings_cols = {col["name"] for col in inspector.get_columns("platform_settings")}
        if "affiliate_commission_percent" not in settings_cols:
            op.add_column(
                "platform_settings",
                sa.Column(
                    "affiliate_commission_percent",
                    sa.Numeric(10, 4),
                    nullable=False,
                    server_default="25.0000",
                ),
            )
        if "affiliate_hold_days" not in settings_cols:
            op.add_column(
                "platform_settings",
                sa.Column("affiliate_hold_days", sa.Integer(), nullable=False, server_default="14"),
            )
        if "affiliate_min_payout_usdt" not in settings_cols:
            op.add_column(
                "platform_settings",
                sa.Column(
                    "affiliate_min_payout_usdt",
                    sa.Numeric(18, 8),
                    nullable=False,
                    server_default="50",
                ),
            )
        if "affiliate_cookie_days" not in settings_cols:
            op.add_column(
                "platform_settings",
                sa.Column("affiliate_cookie_days", sa.Integer(), nullable=False, server_default="60"),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "platform_settings" in tables:
        settings_cols = {col["name"] for col in inspector.get_columns("platform_settings")}
        for col in (
            "affiliate_cookie_days",
            "affiliate_min_payout_usdt",
            "affiliate_hold_days",
            "affiliate_commission_percent",
        ):
            if col in settings_cols:
                op.drop_column("platform_settings", col)

    if "tenants" in tables:
        tenant_cols = {col["name"] for col in inspector.get_columns("tenants")}
        if "referral_partner_id" in tenant_cols:
            op.drop_index("ix_tenants_referral_partner_id", table_name="tenants")
            op.drop_column("tenants", "referral_partner_id")

    for table in (
        "partner_commissions",
        "partner_referral_events",
        "partner_payout_requests",
        "partners",
    ):
        if table in tables:
            op.drop_table(table)
