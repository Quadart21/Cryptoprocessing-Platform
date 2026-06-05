import asyncio
import logging

from app.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services.platform_ops_telegram_service import PlatformOpsTelegramService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.ops_telegram.send_ops_daily_report")
def send_ops_daily_report() -> bool:
    async def _run() -> bool:
        async with AsyncSessionLocal() as db:
            try:
                sent = await PlatformOpsTelegramService(db).build_and_send_daily_report()
                await db.commit()
                return sent
            except Exception:
                await db.rollback()
                logger.exception("Failed to send ops daily report")
                return False

    return asyncio.run(_run())
