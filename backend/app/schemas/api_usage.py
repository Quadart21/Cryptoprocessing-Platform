from datetime import date

from pydantic import BaseModel, Field


class ApiUsageRouteItem(BaseModel):
    route_key: str
    label: str
    total: int
    errors: int


class ApiUsageCategoryItem(BaseModel):
    category: str
    label: str
    total: int
    errors: int
    routes: list[ApiUsageRouteItem]


class ApiUsageResponse(BaseModel):
    scope_type: str
    scope_id: str
    period_days: int
    period_start: date
    period_end: date
    total_requests: int
    total_errors: int
    categories: list[ApiUsageCategoryItem]


class ApiUsageQuery(BaseModel):
    days: int = Field(default=30, ge=1, le=45)
