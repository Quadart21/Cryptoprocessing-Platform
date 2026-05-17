from datetime import datetime, timezone
from secrets import token_hex

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.provider_event import ProviderEvent
from app.services.statistics_exclusion_service import StatisticsExclusionService


class EventService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_event(
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
        existing = await self.get_event_by_provider_event_id(
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
        await self.db.flush()
        return event

    async def list_events(self, limit: int = 100) -> list[ProviderEvent]:
        stmt = (
            select(ProviderEvent)
            .join(Invoice, Invoice.id == ProviderEvent.invoice_id)
            .order_by(ProviderEvent.created_at.desc())
            .limit(limit)
        )
        excluded = await StatisticsExclusionService(self.db).excluded_tenant_ids()
        if excluded:
            stmt = stmt.where(Invoice.tenant_id.not_in(excluded))
        return list((await self.db.scalars(stmt)).all())

    async def list_events_by_invoice(self, invoice_id: str) -> list[ProviderEvent]:
        stmt = (
            select(ProviderEvent)
            .where(ProviderEvent.invoice_id == invoice_id)
            .order_by(ProviderEvent.created_at.desc())
        )
        return list((await self.db.scalars(stmt)).all())

    async def get_event_by_provider_event_id(
        self,
        provider_event_id: str,
        *,
        provider_name: str | None = None,
    ) -> ProviderEvent | None:
        stmt = select(ProviderEvent).where(ProviderEvent.provider_event_id == provider_event_id)
        if provider_name:
            stmt = stmt.where(ProviderEvent.provider_name == provider_name)
        return await self.db.scalar(stmt)
