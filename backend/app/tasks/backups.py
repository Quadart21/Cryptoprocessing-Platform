import asyncio
import logging

from app.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services.backup_service import BackupService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.backups.run_backup_job")
def run_backup_job(job_id: str) -> str:
    async def _run() -> str:
        async with AsyncSessionLocal() as db:
            job = await BackupService(db).run_job(job_id)
            return job.status

    return asyncio.run(_run())


@celery_app.task(name="app.tasks.backups.run_scheduled_backups")
def run_scheduled_backups() -> int:
    async def _run() -> int:
        async with AsyncSessionLocal() as db:
            try:
                count = await BackupService(db).run_due_scheduled_backups()
                return count
            except Exception:
                await db.rollback()
                logger.exception("Scheduled backup tick failed")
                return 0

    return asyncio.run(_run())
