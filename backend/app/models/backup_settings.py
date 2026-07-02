from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class BackupSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "backup_settings"

    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    google_drive_folder_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_service_account_json_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_oauth_refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_oauth_user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upload_to_drive_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    schedule_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    schedule_frequency: Mapped[str] = mapped_column(String(32), nullable=False, default="daily")
    schedule_hour_utc: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    schedule_weekday: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    schedule_scopes_json: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default='["full"]',
    )
    local_retention_count: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    last_scheduled_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
