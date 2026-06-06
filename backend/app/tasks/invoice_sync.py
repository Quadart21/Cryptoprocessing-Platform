import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.models.invoice import Invoice
from app.providers.crypto_cash import CryptoCashProviderError
from app.services.billing_policy_service import BillingPolicyService
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.invoice_service import InvoiceService
from app.services.rates_service import RatesService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.invoice_sync.sync_all_pending_invoices")
def sync_all_pending_invoices() -> dict:
    return asyncio.run(_sync_all_pending_invoices())


async def _sync_all_pending_invoices() -> dict:
    synced_count = 0
    failed_count = 0
    errors = []

    async with AsyncSessionLocal() as db:
        pending_invoices = list(
            (
                await db.scalars(
                    select(Invoice)
                    .where(Invoice.status.in_(["pending", "confirming", "paid"]))
                    .order_by(Invoice.created_at.desc())
                    .limit(100)
                )
            ).all()
        )

        logger.info("Found %s pending/confirming/paid invoices to sync", len(pending_invoices))

        for invoice in pending_invoices:
            try:
                invoice_service = InvoiceService(db)
                await invoice_service.sync_invoice_status(
                    tenant_id=invoice.tenant_id,
                    invoice_id=invoice.id,
                    project_id=invoice.project_id,
                )
                synced_count += 1
                logger.info("Synced invoice %s, status: %s", invoice.id, invoice.status)
            except CryptoCashProviderError as exc:
                failed_count += 1
                error_msg = f"Invoice {invoice.id}: {exc.message}"
                errors.append(error_msg)
                logger.error(error_msg)
            except ValueError as exc:
                failed_count += 1
                error_msg = f"Invoice {invoice.id}: {exc}"
                errors.append(error_msg)
                logger.error(error_msg)
            except Exception as exc:
                failed_count += 1
                error_msg = f"Invoice {invoice.id}: Unexpected error: {exc}"
                errors.append(error_msg)
                logger.exception(error_msg)

        result = {
            "synced": synced_count,
            "failed": failed_count,
            "errors": errors[:10],
        }
        logger.info("Sync completed: %s", result)
        if failed_count > 0:
            from app.services.platform_ops_notify import notify_provider_alert

            summary_lines = errors[:5]
            if len(errors) > 5:
                summary_lines.append(f"… и ещё {len(errors) - 5} ошибок")
            await notify_provider_alert(
                db,
                title="⚠️ Ошибки синхронизации Crypto-Cash",
                lines=[
                    f"Успешно: {synced_count}, ошибок: {failed_count}",
                    *summary_lines,
                ],
            )
        return result


@celery_app.task(name="app.tasks.invoice_sync.expire_unpaid_invoices")
def expire_unpaid_invoices() -> dict:
    return asyncio.run(_expire_unpaid_invoices())


async def _expire_unpaid_invoices() -> dict:
    cancelled_count = 0
    failed_count = 0
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        expired_pending = list(
            (
                await db.scalars(
                    select(Invoice)
                    .where(
                        Invoice.status == "pending",
                        Invoice.expires_at < now,
                    )
                    .order_by(Invoice.expires_at.asc())
                    .limit(200)
                )
            ).all()
        )

        invoice_service = InvoiceService(db)
        for invoice in expired_pending:
            try:
                updated = await invoice_service.sync_invoice_status(
                    tenant_id=invoice.tenant_id,
                    invoice_id=str(invoice.id),
                    project_id=invoice.project_id,
                )
                if updated.status == "cancelled":
                    cancelled_count += 1
            except (CryptoCashProviderError, ValueError) as exc:
                failed_count += 1
                logger.warning("Expire invoice %s failed: %s", invoice.id, exc)
            except Exception:
                failed_count += 1
                logger.exception("Expire invoice %s failed unexpectedly", invoice.id)

    result = {
        "candidates": len(expired_pending),
        "cancelled": cancelled_count,
        "failed": failed_count,
    }
    logger.info("Expire unpaid invoices completed: %s", result)
    return result


@celery_app.task(name="app.tasks.invoice_sync.sync_single_invoice")
def sync_single_invoice(invoice_id: str) -> dict:
    return asyncio.run(_sync_single_invoice(invoice_id))


async def _sync_single_invoice(invoice_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        try:
            invoice = await db.scalar(select(Invoice).where(Invoice.id == invoice_id))
            if invoice is None:
                return {"success": False, "error": "Invoice not found"}

            invoice_service = InvoiceService(db)
            await invoice_service.sync_invoice_status(
                tenant_id=invoice.tenant_id,
                invoice_id=invoice.id,
                project_id=invoice.project_id,
            )

            return {
                "success": True,
                "invoice_id": invoice_id,
                "status": invoice.status,
            }
        except CryptoCashProviderError as exc:
            return {"success": False, "error": exc.message}
        except ValueError as exc:
            return {"success": False, "error": str(exc)}
        except Exception as exc:
            logger.exception("Error syncing invoice %s", invoice_id)
            return {"success": False, "error": f"Unexpected error: {exc}"}


@celery_app.task(name="app.tasks.invoice_sync.refresh_exchange_rate_cache")
def refresh_exchange_rate_cache() -> dict:
    return asyncio.run(_refresh_exchange_rate_cache())


async def _refresh_exchange_rate_cache() -> dict:
    async with AsyncSessionLocal() as db:
        try:
            rates_payload = await RatesService(db).list_rates()
            symbols = sorted(
                {
                    str(item.currency).strip().upper()
                    for item in rates_payload.items
                    if str(item.currency).strip()
                }
            )
            fresh_rates = get_exchange_rate_service().refresh_rates_for_symbols(symbols)
            await BillingPolicyService(db).update_cached_exchange_rates(fresh_rates)
            result = {
                "symbols_total": len(symbols),
                "rates_cached": len(fresh_rates),
            }
            logger.info("Exchange rate cache refreshed: %s", result)
            return result
        except Exception as exc:
            logger.exception("Failed to refresh exchange rate cache")
            return {"success": False, "error": str(exc)}
