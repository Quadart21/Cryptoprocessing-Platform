from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.providers.crypto_cash import CryptoCashProviderError
from app.schemas.invoice import PublicPaymentResponse
from app.services.invoice_service import InvoiceService
from app.services.payment_page_service import PaymentPageService

router = APIRouter()


@router.get("/pay/{payment_token}", response_model=PublicPaymentResponse)
async def get_public_payment(
    payment_token: str,
    db: AsyncSession = Depends(get_db),
) -> PublicPaymentResponse:
    payment_service = PaymentPageService(db)
    invoice = await payment_service.get_invoice_by_token(payment_token)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Платёж не найден.")
    return payment_service.to_public_response(invoice)


@router.post("/pay/{payment_token}/refresh", response_model=PublicPaymentResponse)
async def refresh_public_payment(
    payment_token: str,
    db: AsyncSession = Depends(get_db),
) -> PublicPaymentResponse:
    payment_service = PaymentPageService(db)
    invoice = await payment_service.get_invoice_by_token(payment_token)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Платёж не найден.")

    if invoice.status in {"pending", "paid"}:
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

    return payment_service.to_public_response(invoice)
