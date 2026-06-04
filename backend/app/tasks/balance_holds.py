import asyncio
import logging

from app.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services.balance_hold_service import BalanceHoldService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.balance_holds.release_matured_balance_holds")
def release_matured_balance_holds() -> dict:
    return asyncio.run(_release_matured_balance_holds())


async def _release_matured_balance_holds() -> dict:
    async with AsyncSessionLocal() as db:
        hold_service = BalanceHoldService(db)
        stats = await hold_service.sync_tenant_balance_holds()
        await db.commit()
        result = stats
        if stats["released"] or stats["reconciled"]:
            logger.info("Balance hold sync: %s", stats)
        return result
