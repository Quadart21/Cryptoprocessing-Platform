import asyncio
import logging

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
        
        logger.info(f"Found {len(pending_invoices)} pending/confirming/paid invoices to sync")
        
        for invoice in pending_invoices:
            try:
                invoice_service = InvoiceService(db)
                await invoice_service.sync_invoice_status(
                    tenant_id=invoice.tenant_id,
                    invoice_id=invoice.id,
                    project_id=invoice.project_id,
                )
                synced_count += 1
                logger.info(f"Synced invoice {invoice.id}, status: {invoice.status}")
            except CryptoCashProviderError as exc:
                failed_count += 1
                error_msg = f"Invoice {invoice.id}: {exc.message}"
                errors.append(error_msg)
                logger.error(error_msg)
            except ValueError as exc:
                failed_count += 1
                error_msg = f"Invoice {invoice.id}: {str(exc)}"
                errors.append(error_msg)
                logger.error(error_msg)
            except Exception as exc:
                failed_count += 1
                error_msg = f"Invoice {invoice.id}: Unexpected error: {str(exc)}"
                errors.append(error_msg)
                logger.exception(error_msg)
        
        result = {
            "synced": synced_count,
            "failed": failed_count,
            "errors": errors[:10],
        }
        logger.info(f"Sync completed: {result}")
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
            logger.exception(f"Error syncing invoice {invoice_id}")
            return {"success": False, "error": f"Unexpected error: {str(exc)}"}


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
