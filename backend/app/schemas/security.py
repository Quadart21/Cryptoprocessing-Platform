from datetime import datetime

from pydantic import BaseModel, Field


class TwoFactorStatusResponse(BaseModel):
    enabled: bool
    configured: bool
    confirmed_at: datetime | None = None


class TwoFactorSetupResponse(BaseModel):
    enabled: bool
    secret: str
    issuer: str
    account_name: str
    otpauth_url: str


class TwoFactorEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class TwoFactorDisableRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)
    code: str | None = Field(default=None, min_length=6, max_length=8)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
