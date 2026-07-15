"""enable partner notification events in platform settings

Revision ID: 20260715_0001
Revises: 20260714_0002
Create Date: 2026-07-15
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260715_0001"
down_revision = "20260714_0002"
branch_labels = None
depends_on = None

PARTNER_EVENT_CODES = [
    "partner_application_submitted",
    "partner_application_approved",
    "partner_application_rejected",
    "partner_suspended",
    "partner_merchant_attributed",
    "partner_payout_requested",
    "partner_payout_approved",
    "partner_payout_rejected",
]


def _merge_event_codes(raw_value: str | None) -> str | None:
    if raw_value is None:
        return None
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list):
        return None
    # Empty list means runtime fallback to all defaults — leave untouched.
    if not parsed:
        return None
    current = {str(item).strip() for item in parsed if str(item).strip()}
    merged = sorted(current | set(PARTNER_EVENT_CODES))
    if merged == sorted(current):
        return None
    return json.dumps(merged, ensure_ascii=False)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "platform_settings" not in inspector.get_table_names():
        return
    cols = {col["name"] for col in inspector.get_columns("platform_settings")}
    select_cols = [
        "id",
        "email_notification_events_json",
        "telegram_notification_events_json",
    ]
    if "ops_telegram_events_json" in cols:
        select_cols.append("ops_telegram_events_json")

    rows = bind.execute(
        sa.text(f"SELECT {', '.join(select_cols)} FROM platform_settings")
    ).mappings().all()
    for row in rows:
        updates: dict[str, str] = {}
        if "email_notification_events_json" in cols:
            email_merged = _merge_event_codes(row.get("email_notification_events_json"))
            if email_merged is not None:
                updates["email_notification_events_json"] = email_merged
        if "telegram_notification_events_json" in cols:
            telegram_merged = _merge_event_codes(row.get("telegram_notification_events_json"))
            if telegram_merged is not None:
                updates["telegram_notification_events_json"] = telegram_merged
        if "ops_telegram_events_json" in cols:
            ops_merged = _merge_event_codes(row.get("ops_telegram_events_json"))
            if ops_merged is not None:
                updates["ops_telegram_events_json"] = ops_merged
        if not updates:
            continue
        set_clause = ", ".join(f"{key} = :{key}" for key in updates)
        bind.execute(
            sa.text(f"UPDATE platform_settings SET {set_clause} WHERE id = :id"),
            {"id": row["id"], **updates},
        )


def downgrade() -> None:
    pass
