from datetime import datetime

from pydantic import BaseModel, Field


class ProjectSummary(BaseModel):
    id: str
    tenant_id: str
    name: str
    domain: str
    description: str | None = None
    status: str


class ApiKeyCreateResponse(BaseModel):
    id: str
    project_id: str
    public_key: str
    secret_key: str
    status: str


class ApiKeySummary(BaseModel):
    id: str
    project_id: str
    public_key: str
    status: str


class ApiKeyRegenerateResponse(ApiKeySummary):
    secret_key: str


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    domain: str = Field(min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class WebhookConfigRequest(BaseModel):
    project_id: str
    webhook_url: str = Field(min_length=8, max_length=500)
    webhook_secret: str | None = Field(default=None, max_length=255)


class WebhookConfigResponse(BaseModel):
    project_id: str
    webhook_url: str | None
    has_secret: bool


class WebhookTestRequest(BaseModel):
    project_id: str


class WebhookTestResponse(BaseModel):
    project_id: str
    webhook_url: str
    event_id: str
    delivered_at: datetime
    attempts: int
    status_code: int
    response_preview: str | None = None
