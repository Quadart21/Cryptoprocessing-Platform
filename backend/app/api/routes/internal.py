from json import JSONDecodeError

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.tenant import set_db_security_context
from app.schemas.invoice import InvoiceResponse
from app.schemas.webhook import CryptoCashWebhookPayload
from app.services.invoice_service import InvoiceService
from app.services.webhook_security import (
    CryptoCashWebhookSecurityError,
    CryptoCashWebhookSecurityService,
)

router = APIRouter()


@router.post("/webhook/crypto-cash", response_model=InvoiceResponse)
async def crypto_cash_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> InvoiceResponse:
    await set_db_security_context(db, tenant_id=None, is_superadmin=True)

    try:
        raw_payload = await request.json()
    except JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload.",
        ) from exc
    try:
        payload = CryptoCashWebhookPayload.model_validate(raw_payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc

    try:
        await CryptoCashWebhookSecurityService(db).verify(payload, raw_payload)
    except CryptoCashWebhookSecurityError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    invoice_service = InvoiceService(db)
    try:
        invoice = await invoice_service.apply_provider_status(
            provider_order_id=payload.resolved_provider_order_id,
            merchant_order_id=payload.resolved_merchant_order_id,
            provider_status=payload.resolved_status or "",
            tx_hash=payload.resolved_tx_hash,
            source="webhook",
            raw_payload=raw_payload,
            provider_event_id=payload.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return InvoiceResponse(
        id=invoice.id,
        project_id=invoice.project_id,
        merchant_order_id=invoice.merchant_order_id,
        provider_order_id=invoice.provider_order_id,
        amount_fiat=invoice.amount_fiat,
        fiat_currency=invoice.fiat_currency,
        amount_crypto=invoice.amount_crypto,
        crypto_currency=invoice.crypto_currency,
        network=invoice.network,
        payment_address=invoice.payment_address,
        qr_url=invoice.qr_url,
        status=invoice.status,
        expires_at=invoice.expires_at,
        created_at=invoice.created_at,
    )
