from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.public_urls import resolve_public_asset_url_for_web
from app.models.platform_setting import PlatformSetting


class SeoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_public_settings(self) -> dict[str, Any]:
        settings = await self.db.scalar(
            select(PlatformSetting).where(PlatformSetting.code == "default")
        )
        if settings is None:
            return self._get_default_settings()
        
        return {
            "title": settings.seo_title or "NorenDigital",
            "description": settings.seo_description or "Accept crypto payments",
            "keywords": settings.seo_keywords or "",
            "favicon_url": settings.seo_favicon_url,
            "og_image_url": settings.seo_og_image_url,
            "robots": settings.seo_robots or "index, follow",
            "canonical_url": settings.seo_canonical_url,
            "brand_name": (settings.notification_brand_name or "").strip() or "NorenDigital",
            "logo_url": resolve_public_asset_url_for_web((settings.notification_logo_url or "").strip() or None),
        }

    @staticmethod
    def _get_default_settings() -> dict[str, Any]:
        return {
            "title": "NorenDigital",
            "description": "Accept crypto payments",
            "keywords": "",
            "favicon_url": None,
            "og_image_url": None,
            "robots": "index, follow",
            "canonical_url": None,
            "brand_name": "NorenDigital",
            "logo_url": None,
        }
