from pydantic import BaseModel

from app.schemas.project import ApiKeySummary, ProjectSummary
from app.schemas.tenant import TenantSummary
from pydantic import BaseModel


class TenantOwnerSummary(BaseModel):
    id: str
    email: str
    full_name: str
    status: str


class TenantDetailResponse(BaseModel):
    tenant: TenantSummary
    owner: TenantOwnerSummary
    projects: list[ProjectSummary]
    api_keys: list[ApiKeySummary]
    invoices_count: int
    approved_projects_count: int

