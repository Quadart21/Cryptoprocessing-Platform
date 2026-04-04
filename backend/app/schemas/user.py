from pydantic import BaseModel


class CurrentUserResponse(BaseModel):
    id: str
    tenant_id: str | None
    email: str
    full_name: str
    role: str
    status: str
    permissions: list[str] = []
    totp_enabled: bool = False
