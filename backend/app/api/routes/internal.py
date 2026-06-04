from json import JSONDecodeError

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.tenant import set_db_security_context
from app.schemas.invoice import InvoiceResponse
from app.schemas.webhook import CryptoCashWebhookPayload
from app.services.api_usage_service import get_api_usage_service
from app.services.invoice_service import InvoiceService
from app.services.provider_webhook_log import ProviderWebhookLogService
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
        ProviderWebhookLogService.log_incoming(
            outcome="invalid_json",
            detail="Request body is not valid JSON.",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload.",
        ) from exc
    try:
        payload = CryptoCashWebhookPayload.model_validate(raw_payload)
    except ValidationError as exc:
        ProviderWebhookLogService.log_incoming(
            outcome="validation_error",
            raw_payload=raw_payload if isinstance(raw_payload, dict) else None,
            detail=str(exc.errors()),
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc

    try:
        await CryptoCashWebhookSecurityService(db).verify(payload, raw_payload)
    except CryptoCashWebhookSecurityError as exc:
        ProviderWebhookLogService.log_incoming(
            outcome="rejected",
            provider_event_id=payload.id,
            provider_order_id=payload.resolved_provider_order_id,
            merchant_order_id=payload.resolved_merchant_order_id,
            provider_status=payload.resolved_status,
            raw_payload=raw_payload,
            detail=str(exc),
        )
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
        ProviderWebhookLogService.log_incoming(
            outcome="processing_error",
            provider_event_id=payload.id,
            provider_order_id=payload.resolved_provider_order_id,
            merchant_order_id=payload.resolved_merchant_order_id,
            provider_status=payload.resolved_status,
            raw_payload=raw_payload,
            detail=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    get_api_usage_service().record(
        category="provider_inbound",
        route_key="POST /internal/webhook/crypto-cash",
        tenant_id=invoice.tenant_id,
        project_id=invoice.project_id,
    )

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
