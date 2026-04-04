from pydantic import BaseModel, EmailStr, Field


class TenantCreateRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    owner_email: EmailStr
    owner_full_name: str = Field(min_length=2, max_length=255)
    domain: str = Field(min_length=3, max_length=255)
    project_description: str | None = Field(default=None, max_length=1000)
    timezone: str = Field(default="Europe/Amsterdam", max_length=100)
    base_currency: str = Field(default="USD", min_length=3, max_length=10)
    plan: str = Field(default="default", max_length=50)


class TenantSummary(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    review_comment: str | None = None
    owner_email: str


class TenantCreateResponse(TenantSummary):
    invite_token: str
    project_id: str
    api_public_key: str
    api_secret_key: str


class TenantApprovalRequest(BaseModel):
    review_comment: str | None = Field(default=None, max_length=500)

