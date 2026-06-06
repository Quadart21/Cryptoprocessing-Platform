from json import JSONDecodeError

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.tenant import set_db_security_context
from app.schemas.invoice import InvoiceResponse
from app.schemas.webhook import CryptoCashWebhookPayload, webhook_context_from_raw
from app.services.api_usage_service import get_api_usage_service
from app.services.checkout_delivery_service import CheckoutDeliveryService
from app.services.invoice_lifecycle import checkout_payment_fields
from app.services.invoice_service import InvoiceService
from app.services.payment_page_service import PaymentPageService
from app.services.project_service import ProjectService
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
        cc_status = payload.resolved_status or ""
        invoice = await invoice_service.apply_provider_status(
            provider_order_id=payload.resolved_provider_order_id,
            merchant_order_id=payload.resolved_merchant_order_id,
            provider_status=cc_status,
            tx_hash=payload.resolved_tx_hash,
            source="webhook",
            raw_payload={
                **raw_payload,
                "_webhook_context": webhook_context_from_raw(raw_payload),
            },
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

    project = await ProjectService(db).get_project(invoice.project_id)
    checkout_delivery = (
        CheckoutDeliveryService.normalize(project.checkout_delivery)
        if project is not None
        else CheckoutDeliveryService.normalize(None)
    )
    payment_fields = checkout_payment_fields(
        invoice,
        mode=checkout_delivery,
        payment_page_url=PaymentPageService.payment_page_url_for(invoice),
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
        payment_address=payment_fields.payment_address,
        payment_memo=payment_fields.payment_memo,
        qr_url=payment_fields.qr_url,
        payment_page_url=payment_fields.payment_page_url,
        checkout_delivery=payment_fields.checkout_delivery,
        status=invoice.status,
        expires_at=invoice.expires_at,
        created_at=invoice.created_at,
    )
