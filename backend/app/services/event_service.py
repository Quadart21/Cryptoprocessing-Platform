from datetime import datetime, timezone
from secrets import token_hex

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.provider_event import ProviderEvent


class EventService:
    def __init__(self, db: Session):
        self.db = db

    def create_event(
        self,
        invoice_id: str,
        event_type: str,
        source: str,
        payload: dict | None,
        provider_name: str = "crypto-cash",
        provider_event_id: str | None = None,
        status: str = "processed",
    ) -> ProviderEvent:
        resolved_provider_event_id = provider_event_id or f"evt_{token_hex(8)}"
        existing = self.get_event_by_provider_event_id(
            resolved_provider_event_id,
            provider_name=provider_name,
        )
        if existing is not None:
            return existing

        event = ProviderEvent(
            provider_name=provider_name,
            provider_event_id=resolved_provider_event_id,
            invoice_id=invoice_id,
            event_type=event_type,
            source=source,
            payload_json=payload,
            processed_at=datetime.now(timezone.utc),
            status=status,
        )
        self.db.add(event)
        self.db.flush()
        return event

    def list_events(self, limit: int = 100) -> list[ProviderEvent]:
        stmt = select(ProviderEvent).order_by(ProviderEvent.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def list_events_by_invoice(self, invoice_id: str) -> list[ProviderEvent]:
        stmt = (
            select(ProviderEvent)
            .where(ProviderEvent.invoice_id == invoice_id)
            .order_by(ProviderEvent.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_event_by_provider_event_id(
        self,
        provider_event_id: str,
        *,
        provider_name: str | None = None,
    ) -> ProviderEvent | None:
        stmt = select(ProviderEvent).where(ProviderEvent.provider_event_id == provider_event_id)
        if provider_name:
            stmt = stmt.where(ProviderEvent.provider_name == provider_name)
        return self.db.scalar(stmt)
