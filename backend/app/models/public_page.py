from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PublicPage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "public_pages"

    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    show_in_header: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    show_in_footer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    header_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    footer_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
