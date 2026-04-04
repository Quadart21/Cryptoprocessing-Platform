from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserSummaryResponse(BaseModel):
    id: str
    tenant_id: str | None
    tenant_name: str | None = None
    email: str
    full_name: str
    role: str
    status: str
    totp_enabled: bool
    invited_at: datetime | None = None
    activated_at: datetime | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    role: str = Field(min_length=3, max_length=64)
    tenant_id: str | None = None
    status: str = Field(default="invited", min_length=3, max_length=64)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    create_invite: bool = True


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    role: str | None = Field(default=None, min_length=3, max_length=64)
    tenant_id: str | None = None
    status: str | None = Field(default=None, min_length=3, max_length=64)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    reset_two_factor: bool | None = None


class UserCreateResponse(BaseModel):
    user: UserSummaryResponse
    invite_token: str | None = None


class UserRoleDefinitionResponse(BaseModel):
    role: str
    scope: str
    label: str
    description: str
    permissions: list[str]
