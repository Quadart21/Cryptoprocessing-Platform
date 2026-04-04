from pydantic import BaseModel

from app.schemas.project import ApiKeySummary, ProjectSummary
from app.schemas.tenant import TenantSummary


class TenantDetailResponse(BaseModel):
    tenant: TenantSummary
    projects: list[ProjectSummary]
    api_keys: list[ApiKeySummary]
    invoices_count: int
    approved_projects_count: int

