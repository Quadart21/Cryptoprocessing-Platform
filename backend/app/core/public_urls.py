from urllib.parse import urlparse

from app.core.config import settings


def resolve_public_site_base_url() -> str:
    explicit = (getattr(settings, "public_site_base_url", None) or "").strip().rstrip("/")
    if explicit:
        return explicit

    api_raw = (settings.public_api_base_url or "").strip().rstrip("/")
    if api_raw:
        parsed = urlparse(api_raw if "://" in api_raw else f"https://{api_raw}")
        host = (parsed.hostname or "").strip().lower()
        scheme = parsed.scheme or "https"
        if host.startswith("api."):
            return f"{scheme}://{host[4:]}"
        if host:
            return f"{scheme}://{host}"

    pay_raw = (settings.public_pay_base_url or "").strip().rstrip("/")
    if pay_raw:
        parsed = urlparse(pay_raw if "://" in pay_raw else f"https://{pay_raw}")
        host = (parsed.hostname or "").strip().lower()
        scheme = parsed.scheme or "https"
        if host.startswith("pay."):
            return f"{scheme}://{host[4:]}"
        if host:
            return f"{scheme}://{host}"

    if settings.is_local_env:
        return "http://localhost:8000"

    return ""


def resolve_public_asset_url(raw_value: str | None) -> str | None:
    """Absolute URL — for email/Telegram and external consumers."""
    normalized = (raw_value or "").strip()
    if not normalized:
        return None
    if normalized.startswith("http://") or normalized.startswith("https://"):
        return normalized
    if normalized.startswith("/"):
        path_only = normalized.split("?", 1)[0]
        if path_only.startswith("/uploads/brand/"):
            from app.services.brand_logo_service import BrandLogoService

            normalized = BrandLogoService.append_cache_buster(path_only)
        base = resolve_public_site_base_url()
        if base:
            return f"{base}{normalized}"
        return normalized
    return normalized


def resolve_public_asset_url_for_web(raw_value: str | None) -> str | None:
    """Browser-facing URL: keep /uploads on the current site origin (pay/docs/app subdomains)."""
    normalized = (raw_value or "").strip()
    if not normalized:
        return None
    path_only = normalized.split("?", 1)[0]
    if path_only.startswith("/uploads/brand/"):
        from app.services.brand_logo_service import BrandLogoService

        normalized = BrandLogoService.append_cache_buster(path_only)
    if normalized.startswith("/uploads/"):
        return normalized
    if normalized.startswith("http://") or normalized.startswith("https://"):
        parsed = urlparse(normalized)
        if parsed.path.startswith("/uploads/brand/"):
            from app.services.brand_logo_service import BrandLogoService

            return BrandLogoService.append_cache_buster(parsed.path)
        if parsed.path.startswith("/uploads/"):
            return parsed.path + (f"?{parsed.query}" if parsed.query else "")
        return normalized
    if normalized.startswith("/"):
        return resolve_public_asset_url(normalized)
    return normalized


def is_allowed_brand_logo_reference(raw_value: str | None) -> bool:
    normalized = (raw_value or "").strip().split("?", 1)[0]
    if not normalized:
        return False
    if normalized.startswith("/uploads/brand/"):
        return True
    parsed = urlparse(normalized)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
