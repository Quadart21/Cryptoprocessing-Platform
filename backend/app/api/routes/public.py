import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.db.tenant import set_db_security_context
from app.providers.crypto_cash import CryptoCashProviderError
from app.schemas.invoice import PublicPaymentResponse
from app.schemas.partner import PublicAffiliateConfigResponse
from app.schemas.public_seo import PublicSeoResponse
from app.services.api_usage_service import get_api_usage_service
from app.services.invoice_service import InvoiceService
from app.services.partner_service import PartnerService
from app.services.payment_page_service import PaymentPageService
from app.services.seo_service import SeoService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/seo", response_model=PublicSeoResponse)
async def get_public_seo(db: AsyncSession = Depends(get_db)) -> PublicSeoResponse:
    await _bind_public_payment_context(db)
    settings = await SeoService(db).get_public_settings()
    return PublicSeoResponse(**settings)


@router.get("/affiliate", response_model=PublicAffiliateConfigResponse)
async def get_public_affiliate_config(
    db: AsyncSession = Depends(get_db),
) -> PublicAffiliateConfigResponse:
    await _bind_public_payment_context(db)
    cfg = await PartnerService(db).get_program_config()
    public = cfg.to_public_dict()
    return PublicAffiliateConfigResponse(**public)


async def _bind_public_payment_context(db: AsyncSession) -> None:
    """Public pay lookup by secret token — bypass tenant RLS (no session auth)."""
    await set_db_security_context(db, tenant_id=None, is_superadmin=True)


async def _sync_public_invoice(
    *,
    invoice_service: InvoiceService,
    payment_service: PaymentPageService,
    payment_token: str,
    invoice,
):
    if invoice.status not in {"pending", "confirming", "paid", "cancelled"}:
        return invoice
    try:
        return await invoice_service.sync_invoice_status(
            tenant_id=invoice.tenant_id,
            invoice_id=str(invoice.id),
            project_id=invoice.project_id,
        )
    except (CryptoCashProviderError, ValueError):
        refreshed = await payment_service.get_invoice_by_token(payment_token)
        return refreshed if refreshed is not None else invoice
    except Exception:
        logger.exception("Public pay sync failed for token prefix %s", payment_token[:8])
        refreshed = await payment_service.get_invoice_by_token(payment_token)
        return refreshed if refreshed is not None else invoice


@router.get("/pay/{payment_token}", response_model=PublicPaymentResponse)
async def get_public_payment(
    payment_token: str,
    sync: bool = Query(default=False, description="Синхронизировать статус с провайдером"),
    db: AsyncSession = Depends(get_db),
) -> PublicPaymentResponse:
    await _bind_public_payment_context(db)
    payment_service = PaymentPageService(db)
    invoice = await payment_service.get_invoice_by_token(payment_token)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Платёж не найден.")
    invoice_service = InvoiceService(db)
    initial_status = invoice.status
    did_sync = sync or initial_status in {"pending", "confirming", "cancelled"}
    if did_sync:
        invoice = await _sync_public_invoice(
            invoice_service=invoice_service,
            payment_service=payment_service,
            payment_token=payment_token,
            invoice=invoice,
        )
    else:
        invoice = await invoice_service.ensure_invoice_payment_state(invoice)
    route_key = "GET /public/pay/{token}?sync=1" if did_sync else "GET /public/pay/{token}"
    get_api_usage_service().record(
        category="public_pay",
        route_key=route_key,
        tenant_id=invoice.tenant_id,
        project_id=invoice.project_id,
    )
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

    invoice_service = InvoiceService(db)
    invoice = await _sync_public_invoice(
        invoice_service=invoice_service,
        payment_service=payment_service,
        payment_token=payment_token,
        invoice=invoice,
    )

    get_api_usage_service().record(
        category="public_pay",
        route_key="POST /public/pay/{token}/refresh",
        tenant_id=invoice.tenant_id,
        project_id=invoice.project_id,
    )
    return await payment_service.to_public_response(invoice)
