from pydantic import BaseModel, EmailStr, Field


class RegistrationRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    owner_full_name: str = Field(min_length=2, max_length=255)
    owner_email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    domain: str = Field(min_length=3, max_length=255)
    project_description: str | None = Field(default=None, max_length=1000)
    timezone: str = Field(default="Europe/Amsterdam", max_length=100)
    base_currency: str = Field(default="USD", min_length=3, max_length=10)
    plan: str = Field(default="default", max_length=50)


class RegistrationResponse(BaseModel):
    tenant_id: str
    user_id: str
    status: str
    message: str
