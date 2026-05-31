from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TenantBoundMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Invoice(UUIDPrimaryKeyMixin, TenantBoundMixin, TimestampMixin, Base):
    __tablename__ = "invoices"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    merchant_order_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_order_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    amount_fiat: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    fiat_currency: Mapped[str] = mapped_column(String(10), nullable=False)
    amount_crypto: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    crypto_currency: Mapped[str] = mapped_column(String(20), nullable=False)
    network: Mapped[str] = mapped_column(String(50), nullable=False)
    payment_address: Mapped[str] = mapped_column(String(255), nullable=False)
    qr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payment_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_provider_payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

