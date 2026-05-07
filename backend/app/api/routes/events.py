from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_platform_permission
from app.models.user import User
from app.schemas.event import ProviderEventResponse
from app.services.event_service import EventService

router = APIRouter()


@router.get("/events", response_model=list[ProviderEventResponse])
async def list_events(
    _: User = Depends(require_platform_permission("admin.events.read")),
    db: AsyncSession = Depends(get_db),
) -> list[ProviderEventResponse]:
    events = await EventService(db).list_events()
    return [_map_event(event) for event in events]


@router.get("/invoices/{invoice_id}/events", response_model=list[ProviderEventResponse])
async def list_invoice_events(
    invoice_id: str,
    _: User = Depends(require_platform_permission("admin.events.read")),
    db: AsyncSession = Depends(get_db),
) -> list[ProviderEventResponse]:
    events = await EventService(db).list_events_by_invoice(invoice_id)
    if not events:
        return []
    return [_map_event(event) for event in events]


def _map_event(event) -> ProviderEventResponse:
    return ProviderEventResponse(
        id=event.id,
        provider_name=event.provider_name,
        provider_event_id=event.provider_event_id,
        invoice_id=event.invoice_id,
        event_type=event.event_type,
        source=event.source,
        payload_json=event.payload_json,
        processed_at=event.processed_at,
        status=event.status,
        created_at=event.created_at,
    )
