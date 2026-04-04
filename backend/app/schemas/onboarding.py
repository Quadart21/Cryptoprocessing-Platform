from pydantic import BaseModel


class OnboardingStatusResponse(BaseModel):
    tenant_id: str | None
    tenant_status: str | None
    review_comment: str | None
    project_name: str | None
    project_domain: str | None
    project_description: str | None
    project_status: str | None

