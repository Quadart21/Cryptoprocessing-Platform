"""Fire-and-forget хелперы для ops Telegram — не блокируют основной поток и не падают наружу."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.platform_ops_telegram_service import PlatformOpsTelegramService

logger = logging.getLogger(__name__)


async def notify_platform_ops(
    db: AsyncSession,
    *,
    event_code: str,
    title: str,
    lines: list[str],
    admin_url: str | None = None,
) -> None:
    try:
        await PlatformOpsTelegramService(db).notify_event(
            event_code=event_code,
            title=title,
            lines=lines,
            admin_url=admin_url,
        )
    except Exception:
        logger.exception("Platform ops telegram notify failed for event %s", event_code)


PROVIDER_ALERT_COOLDOWN_KEY = "ops:provider_alert:cooldown"
PROVIDER_ALERT_COOLDOWN_SECONDS = 600


async def notify_provider_alert(
    db: AsyncSession,
    *,
    title: str,
    lines: list[str],
    cooldown_seconds: int = PROVIDER_ALERT_COOLDOWN_SECONDS,
) -> None:
    """Ops-алерт провайдера с анти-спам cooldown (по умолчанию 10 мин)."""
    from app.services.cache_service import get_cache_service

    cache = get_cache_service()
    if cache.get_json(PROVIDER_ALERT_COOLDOWN_KEY) is not None:
        logger.debug("Provider ops alert skipped (cooldown active)")
        return
    await notify_platform_ops(
        db,
        event_code="provider_alert",
        title=title,
        lines=lines,
        admin_url="/admin/invoices",
    )
    cache.set_json(PROVIDER_ALERT_COOLDOWN_KEY, {"v": 1}, ttl_seconds=cooldown_seconds)
