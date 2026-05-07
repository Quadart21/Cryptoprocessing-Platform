from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/seo", response_model=dict)
async def get_seo_settings(db: AsyncSession = Depends(get_db)) -> dict:
    from app.services.seo_service import SeoService
    return await SeoService(db).get_public_settings()
