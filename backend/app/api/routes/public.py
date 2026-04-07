from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/seo", response_model=dict)
async def get_seo_settings(db: Session = Depends(get_db)) -> dict:
    from app.services.seo_service import SeoService
    return SeoService(db).get_public_settings()