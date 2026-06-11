from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class BackupJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "backup_jobs"

    scope: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    trigger: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    local_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    google_drive_file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_drive_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    initiated_by_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
