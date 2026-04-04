from decimal import Decimal

from sqlalchemy import ForeignKey, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TenantBoundMixin, TimestampMixin, UUIDPrimaryKeyMixin


class LedgerEntry(UUIDPrimaryKeyMixin, TenantBoundMixin, TimestampMixin, Base):
    __tablename__ = "ledger_entries"

    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True, index=True)
    transaction_id: Mapped[str | None] = mapped_column(
        ForeignKey("transactions.id"), nullable=True, index=True
    )
    payout_request_id: Mapped[str | None] = mapped_column(
        ForeignKey("payout_requests.id"), nullable=True, index=True
    )
    currency: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    balance_bucket: Mapped[str] = mapped_column(String(50), nullable=False)
    entry_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
