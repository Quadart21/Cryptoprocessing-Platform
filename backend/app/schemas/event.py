from datetime import datetime

from pydantic import BaseModel


class ProviderEventResponse(BaseModel):
    id: str
    provider_name: str
    provider_event_id: str
    invoice_id: str
    event_type: str
    source: str
    payload_json: dict | None
    processed_at: datetime | None
    status: str
    created_at: datetime

