from pydantic import BaseModel, Field


class AssetAvailabilityUpdateRequest(BaseModel):
    currency: str = Field(min_length=2, max_length=20)
    network: str = Field(min_length=2, max_length=50)
    platform_enabled: bool


class AssetAvailabilityUpdateResponse(BaseModel):
    currency: str
    network: str
    platform_enabled: bool
