import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db.session import get_db
from app.models.invoice import Invoice
from app.providers.crypto_cash import CryptoCashProviderError
from app.services.invoice_service import InvoiceService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.invoice_sync.sync_all_pending_invoices")
def sync_all_pending_invoices() -> dict:
    synced_count = 0
    failed_count = 0
    errors = []
    
    db_gen = get_db()
    db = next(db_gen)
    
    try:
        pending_invoices = list(
            db.scalars(
                select(Invoice)
                .where(Invoice.status.in_(["pending", "paid"]))
                .order_by(Invoice.created_at.desc())
                .limit(100)
            ).all()
        )
        
        logger.info(f"Found {len(pending_invoices)} pending/paid invoices to sync")
        
        for invoice in pending_invoices:
            try:
                invoice_service = InvoiceService(db)
                invoice_service.sync_invoice_status(
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
        
    finally:
        db.close()


@celery_app.task(name="app.tasks.invoice_sync.sync_single_invoice")
def sync_single_invoice(invoice_id: str) -> dict:
    db_gen = get_db()
    db = next(db_gen)
    
    try:
        invoice = db.scalar(select(Invoice).where(Invoice.id == invoice_id))
        if invoice is None:
            return {"success": False, "error": "Invoice not found"}
        
        invoice_service = InvoiceService(db)
        invoice_service.sync_invoice_status(
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
    finally:
        db.close()