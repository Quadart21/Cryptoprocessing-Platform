from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.tenant import set_db_security_context
from app.providers.crypto_cash import CryptoCashProviderError
from app.schemas.invoice import PublicPaymentResponse
from app.schemas.public_seo import PublicSeoResponse
from app.services.invoice_service import InvoiceService
from app.services.payment_page_service import PaymentPageService
from app.services.seo_service import SeoService

router = APIRouter()


@router.get("/seo", response_model=PublicSeoResponse)
async def get_public_seo(db: AsyncSession = Depends(get_db)) -> PublicSeoResponse:
    await _bind_public_payment_context(db)
    settings = await SeoService(db).get_public_settings()
    return PublicSeoResponse(**settings)


async def _bind_public_payment_context(db: AsyncSession) -> None:
    """Public pay lookup by secret token — bypass tenant RLS (no session auth)."""
    await set_db_security_context(db, tenant_id=None, is_superadmin=True)


@router.get("/pay/{payment_token}", response_model=PublicPaymentResponse)
async def get_public_payment(
    payment_token: str,
    db: AsyncSession = Depends(get_db),
) -> PublicPaymentResponse:
    await _bind_public_payment_context(db)
    payment_service = PaymentPageService(db)
    invoice = await payment_service.get_invoice_by_token(payment_token)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Платёж не найден.")
    return await payment_service.to_public_response(invoice)


@router.post("/pay/{payment_token}/refresh", response_model=PublicPaymentResponse)
async def refresh_public_payment(
    payment_token: str,
    db: AsyncSession = Depends(get_db),
) -> PublicPaymentResponse:
    await _bind_public_payment_context(db)
    payment_service = PaymentPageService(db)
    invoice = await payment_service.get_invoice_by_token(payment_token)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Платёж не найден.")

    if invoice.status in {"pending", "confirming", "paid"}:
        invoice_service = InvoiceService(db)
        try:
            invoice = await invoice_service.sync_invoice_status(
                tenant_id=invoice.tenant_id,
                invoice_id=str(invoice.id),
                project_id=invoice.project_id,
            )
        except (CryptoCashProviderError, ValueError):
            refreshed = await payment_service.get_invoice_by_token(payment_token)
            if refreshed is not None:
                invoice = refreshed

    return await payment_service.to_public_response(invoice)
