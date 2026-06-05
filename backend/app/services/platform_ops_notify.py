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
