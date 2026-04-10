from functools import lru_cache

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings


@lru_cache(maxsize=1)
def get_celery_app() -> Celery:
    celery_app = Celery(
        "cryptorocessing",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=["app.tasks.invoice_sync"],
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_time_limit=30 * 60,
        task_soft_time_limit=25 * 60,
        worker_prefetch_multiplier=1,
        worker_max_tasks_per_child=1000,
    )
    celery_app.conf.beat_schedule = {
        "sync-invoice-statuses-every-5-minutes": {
            "task": "app.tasks.invoice_sync.sync_all_pending_invoices",
            "schedule": crontab(minute="*/5"),
        },
        "refresh-exchange-rates-every-10-minutes": {
            "task": "app.tasks.invoice_sync.refresh_exchange_rate_cache",
            "schedule": crontab(minute="*/10"),
        },
    }
    return celery_app


celery_app = get_celery_app()
