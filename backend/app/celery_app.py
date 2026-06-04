from functools import lru_cache

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_process_init, worker_process_shutdown

from app.core.config import settings


@lru_cache(maxsize=1)
def get_celery_app() -> Celery:
    celery_app = Celery(
        "cryptorocessing",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=["app.tasks.invoice_sync", "app.tasks.balance_holds"],
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
        "persist-exchange-rates-every-10-minutes": {
            "task": "app.tasks.invoice_sync.refresh_exchange_rate_cache",
            "schedule": crontab(minute="*/10"),
        },
        "release-balance-holds-every-minute": {
            "task": "app.tasks.balance_holds.release_matured_balance_holds",
            "schedule": crontab(minute="*"),
        },
    }
    return celery_app


@worker_process_init.connect
def _start_crypto_cash_rates_polling(**_: object) -> None:
    import asyncio

    from app.db.session import AsyncSessionLocal
    from app.services.billing_policy_service import BillingPolicyService
    from app.services.crypto_cash_rates_cache import get_crypto_cash_rates_cache

    async def _load_price_field() -> str:
        async with AsyncSessionLocal() as session:
            return await BillingPolicyService(session).get_exchange_rate_price_field()

    cache = get_crypto_cash_rates_cache()
    cache.set_price_field(asyncio.run(_load_price_field()))
    cache.start_polling()


@worker_process_shutdown.connect
def _stop_crypto_cash_rates_polling(**_: object) -> None:
    from app.services.crypto_cash_rates_cache import get_crypto_cash_rates_cache

    get_crypto_cash_rates_cache().stop_polling()


celery_app = get_celery_app()
