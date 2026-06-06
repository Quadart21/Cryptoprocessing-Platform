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
    normalized = (raw_value or "").strip()
    if not normalized:
        return None
    if normalized.startswith("http://") or normalized.startswith("https://"):
        return normalized
    if normalized.startswith("/"):
        base = resolve_public_site_base_url()
        if base:
            return f"{base}{normalized}"
        return normalized
    return normalized


def is_allowed_brand_logo_reference(raw_value: str | None) -> bool:
    normalized = (raw_value or "").strip()
    if not normalized:
        return False
    if normalized.startswith("/uploads/brand/"):
        return True
    parsed = urlparse(normalized)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
