from datetime import datetime

from pydantic import BaseModel, Field


class SandboxCreateRequest(BaseModel):
    label: str = Field(min_length=2, max_length=200)
    dns_parent_zone: str = Field(min_length=3, max_length=255, description="Зона в Cloudflare, например example.com")
    desired_subdomain: str = Field(min_length=1, max_length=63, description="Часть поддомена до зоны, например sb-demo")


class SandboxCreateResponse(BaseModel):
    id: str
    tenant_id: str
    project_id: str
    label: str
    dns_parent_zone: str
    desired_subdomain: str
    status: str
    enrollment_token: str
    enrollment_expires_at: datetime
    api_public_key: str
    api_secret_key: str
    owner_email: str
    owner_password: str
    public_api_base_url: str


class SandboxSummaryResponse(BaseModel):
    id: str
    tenant_id: str
    project_id: str | None
    label: str
    dns_parent_zone: str
    desired_subdomain: str
    status: str
    public_base_url: str | None
    tenant_name: str
    created_at: datetime
    origin_ipv4: str | None = None
    agent_public_id: str | None = None


class SandboxEnrollRequest(BaseModel):
    sandbox_id: str
    enrollment_token: str
    agent_instance_id: str | None = Field(default=None, max_length=128)


class SandboxEnrollResponse(BaseModel):
    agent_api_token: str
    public_api_base_url: str
    desired_public_base_url: str
    tenant_id: str
    project_id: str
    agent_public_id: str


class SandboxProvisionDnsRequest(BaseModel):
    ipv4: str = Field(min_length=7, max_length=45)
    proxied: bool = True


class SandboxSettingsResponse(BaseModel):
    cloudflare_token_configured: bool
    cloudflare_token_masked: str | None = None


class SandboxSettingsUpdateRequest(BaseModel):
    cloudflare_api_token: str | None = Field(
        default=None,
        description="Новый API-токен Cloudflare; пустая строка — сброс; None — не менять.",
    )
