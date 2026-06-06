import logging
import re
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.public_urls import resolve_public_asset_url
from app.models.platform_setting import PlatformSetting
from app.services.billing_policy_service import BillingPolicyService

logger = logging.getLogger(__name__)

BRAND_LOGO_PUBLIC_PREFIX = "/uploads/brand/"
BRAND_LOGO_FILENAME = "logo"
MAX_BRAND_LOGO_BYTES = 512 * 1024

ALLOWED_EXTENSIONS = {
    ".svg": {"image/svg+xml", "text/xml", "application/xml", "text/plain", ""},
    ".png": {"image/png", ""},
    ".webp": {"image/webp", ""},
}

SVG_FORBIDDEN_PATTERNS = re.compile(
    r"(<script\b|javascript:|on[a-z]+\s*=|<foreignobject\b|<iframe\b|<embed\b|<object\b)",
    re.IGNORECASE,
)


class BrandLogoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def uploads_dir() -> Path:
        configured = getattr(settings, "brand_uploads_dir", "") or ""
        if configured.strip():
            return Path(configured).expanduser().resolve()
        project_root = Path(__file__).resolve().parents[3]
        return (project_root / "data" / "uploads" / "brand").resolve()

    @classmethod
    def ensure_upload_dir(cls) -> Path:
        target = cls.uploads_dir()
        target.mkdir(parents=True, exist_ok=True)
        return target

    @staticmethod
    def stored_public_path(extension: str) -> str:
        return f"{BRAND_LOGO_PUBLIC_PREFIX}{BRAND_LOGO_FILENAME}{extension}"

    async def upload_logo(self, upload: UploadFile) -> tuple[PlatformSetting, str]:
        extension, content = self._read_and_validate(upload)
        target_dir = self.ensure_upload_dir()

        for existing in target_dir.glob(f"{BRAND_LOGO_FILENAME}.*"):
            if existing.is_file():
                existing.unlink(missing_ok=True)

        destination = target_dir / f"{BRAND_LOGO_FILENAME}{extension}"
        destination.write_bytes(content)

        stored_path = self.stored_public_path(extension)
        billing = BillingPolicyService(self.db)
        platform_settings = await billing.get_platform_settings()
        platform_settings.notification_logo_url = stored_path
        self.db.add(platform_settings)
        await self.db.commit()
        await self.db.refresh(platform_settings)

        public_url = resolve_public_asset_url(stored_path) or stored_path
        logger.info("Brand logo uploaded to %s", stored_path)
        return platform_settings, public_url

    async def remove_uploaded_logo(self) -> PlatformSetting:
        target_dir = self.ensure_upload_dir()
        for existing in target_dir.glob(f"{BRAND_LOGO_FILENAME}.*"):
            if existing.is_file():
                existing.unlink(missing_ok=True)

        billing = BillingPolicyService(self.db)
        platform_settings = await billing.get_platform_settings()
        current = (platform_settings.notification_logo_url or "").strip()
        if current.startswith(BRAND_LOGO_PUBLIC_PREFIX):
            platform_settings.notification_logo_url = None
            self.db.add(platform_settings)
            await self.db.commit()
            await self.db.refresh(platform_settings)
        return platform_settings

    def _read_and_validate(self, upload: UploadFile) -> tuple[str, bytes]:
        original_name = (upload.filename or "").strip().lower()
        extension = Path(original_name).suffix if original_name else ""
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError("Допустимы только SVG, PNG или WebP.")

        content_type = (upload.content_type or "").split(";", 1)[0].strip().lower()
        allowed_types = ALLOWED_EXTENSIONS[extension]
        if content_type and content_type not in allowed_types:
            raise ValueError("Недопустимый тип файла.")

        content = upload.file.read(MAX_BRAND_LOGO_BYTES + 1)
        if len(content) > MAX_BRAND_LOGO_BYTES:
            raise ValueError("Файл логотипа не должен превышать 512 КБ.")

        if extension == ".svg":
            self._validate_svg(content)

        if extension == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Файл PNG повреждён или не является PNG.")
        if extension == ".webp" and not (content[:4] == b"RIFF" and content[8:12] == b"WEBP"):
            raise ValueError("Файл WebP повреждён или не является WebP.")

        return extension, content

    @staticmethod
    def _validate_svg(content: bytes) -> None:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError("SVG должен быть в кодировке UTF-8.") from exc

        normalized = text.strip()
        if not normalized or "<svg" not in normalized.lower():
            raise ValueError("Файл не похож на SVG.")

        if SVG_FORBIDDEN_PATTERNS.search(normalized):
            raise ValueError("SVG содержит небезопасные элементы.")
