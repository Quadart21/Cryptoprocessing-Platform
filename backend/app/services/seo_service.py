from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform_setting import PlatformSetting


class SeoService:
    def __init__(self, db: Session):
        self.db = db

    def get_public_settings(self) -> dict[str, Any]:
        settings = self.db.scalar(
            select(PlatformSetting).where(PlatformSetting.code == "default")
        )
        if settings is None:
            return self._get_default_settings()
        
        return {
            "title": settings.seo_title or "Crypto Processing",
            "description": settings.seo_description or "Accept crypto payments",
            "keywords": settings.seo_keywords or "",
            "favicon_url": settings.seo_favicon_url,
            "og_image_url": settings.seo_og_image_url,
            "robots": settings.seo_robots or "index, follow",
            "canonical_url": settings.seo_canonical_url,
        }

    @staticmethod
    def _get_default_settings() -> dict[str, Any]:
        return {
            "title": "Crypto Processing",
            "description": "Accept crypto payments",
            "keywords": "",
            "favicon_url": None,
            "og_image_url": None,
            "robots": "index, follow",
            "canonical_url": None,
        }