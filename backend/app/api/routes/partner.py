from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, user_permissions
from app.core.rbac import is_affiliate_role
from app.db.tenant import set_db_security_context
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.partner import (
    PartnerApplyRequest,
    PartnerApplyResponse,
    PartnerCommissionRow,
    PartnerMeResponse,
    PartnerMerchantRow,
    PartnerPayoutCreateRequest,
    PartnerPayoutRow,
    PartnerProfileUpdateRequest,
    PartnerReferralClickRequest,
)
from app.schemas.user import CurrentUserResponse
from app.services.partner_service import PartnerService, PartnerServiceError
from app.services.platform_ops_notify import notify_platform_ops

router = APIRouter()
logger = logging.getLogger(__name__)


async def require_affiliate_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not is_affiliate_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Affiliate role required.",
        )
    await set_db_security_context(db, tenant_id=None, is_superadmin=True)
    return current_user


@router.post("/auth/apply", response_model=PartnerApplyResponse, status_code=status.HTTP_201_CREATED)
async def apply_partner(
    payload: PartnerApplyRequest,
    db: AsyncSession = Depends(get_db),
) -> PartnerApplyResponse:
    service = PartnerService(db)
    try:
        partner = await service.apply(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            display_name=payload.display_name,
            contact_telegram=payload.contact_telegram,
            payout_address=payload.payout_address,
            payout_network=payload.payout_network,
        )
    except PartnerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await notify_platform_ops(
        db,
        event_code="partner_application_submitted",
        title="Новая заявка партнёра",
        lines=[
            f"Партнёр: {partner.display_name}",
            f"Email: {payload.email.strip().lower()}",
            f"Код: {partner.referral_code}",
            f"Статус: {partner.status}",
            f"Partner ID: {partner.id}",
        ],
        admin_url="/admin/partners",
    )

    message = (
        "Application approved. You can sign in to the partner cabinet."
        if partner.status == "approved"
        else "Application submitted. You can sign in; the cabinet unlocks after admin approval."
    )
    return PartnerApplyResponse(
        partner_id=partner.id,
        user_id=partner.user_id,
        status=partner.status,
        referral_code=partner.referral_code,
        message=message,
    )


@router.post("/referral/click", status_code=status.HTTP_204_NO_CONTENT)
async def track_referral_click(
    payload: PartnerReferralClickRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    await PartnerService(db).record_click(
        referral_code=payload.referral_code,
        ip_address=ip,
        user_agent=ua,
        landing_path=payload.landing_path,
    )


@router.get("/me", response_model=CurrentUserResponse)
async def partner_user_me(
    current_user: User = Depends(require_affiliate_user),
) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=current_user.id,
        tenant_id=current_user.tenant_id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        status=current_user.status,
        permissions=user_permissions(current_user),
        totp_enabled=current_user.totp_enabled,
    )


@router.get("/dashboard", response_model=PartnerMeResponse)
async def partner_dashboard(
    current_user: User = Depends(require_affiliate_user),
    db: AsyncSession = Depends(get_db),
) -> PartnerMeResponse:
    service = PartnerService(db)
    partner = await service.get_by_user_id(current_user.id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner profile not found.")

    cfg = await service.get_program_config()
    commission_percent = await service.effective_commission_percent(partner)
    balances = await service.balances(partner.id)
    funnel = await service.funnel_stats(partner.id)
    if partner.status != "approved" and not cfg.partner_cabinet_when_pending:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner cabinet is available only after approval.",
        )

    return PartnerMeResponse(
        partner_id=partner.id,
        user_id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        display_name=partner.display_name,
        contact_telegram=partner.contact_telegram,
        status=partner.status,
        referral_code=partner.referral_code,
        referral_link_path=f"/?ref={partner.referral_code}",
        commission_percent=commission_percent if partner.status == "approved" else cfg.commission_percent,
        payout_address=partner.payout_address,
        payout_network=partner.payout_network,
        review_comment=partner.review_comment,
        hold_days=cfg.hold_days,
        min_payout_usdt=cfg.min_payout_usdt,
        cookie_days=cfg.cookie_days,
        pending_hold_usdt=balances["pending_hold_usdt"],
        available_usdt=balances["available_usdt"],
        paid_usdt=balances["paid_usdt"],
        locked_payout_usdt=balances["locked_payout_usdt"],
        clicks=funnel["clicks"] if cfg.show_funnel_clicks_to_partners else 0,
        registrations=funnel["registrations"],
        approved_merchants=funnel["approved_merchants"],
        merchants_with_volume=funnel["merchants_with_volume"],
    )


@router.patch("/profile", response_model=PartnerMeResponse)
async def update_partner_profile(
    payload: PartnerProfileUpdateRequest,
    current_user: User = Depends(require_affiliate_user),
    db: AsyncSession = Depends(get_db),
) -> PartnerMeResponse:
    service = PartnerService(db)
    partner = await service.get_by_user_id(current_user.id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner profile not found.")
    await service.update_profile(
        partner,
        display_name=payload.display_name,
        contact_telegram=payload.contact_telegram,
        payout_address=payload.payout_address,
        payout_network=payload.payout_network,
    )
    return await partner_dashboard(current_user=current_user, db=db)


@router.get("/merchants", response_model=list[PartnerMerchantRow])
async def partner_merchants(
    current_user: User = Depends(require_affiliate_user),
    db: AsyncSession = Depends(get_db),
) -> list[PartnerMerchantRow]:
    service = PartnerService(db)
    partner = await service.get_by_user_id(current_user.id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner profile not found.")
    if partner.status != "approved":
        return []
    rows = await service.list_merchants(partner.id)
    return [PartnerMerchantRow(**row) for row in rows]


@router.get("/commissions", response_model=list[PartnerCommissionRow])
async def partner_commissions(
    current_user: User = Depends(require_affiliate_user),
    db: AsyncSession = Depends(get_db),
) -> list[PartnerCommissionRow]:
    service = PartnerService(db)
    partner = await service.get_by_user_id(current_user.id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner profile not found.")
    if partner.status != "approved":
        return []

    commissions = await service.list_commissions(partner.id)
    tenant_ids = {row.tenant_id for row in commissions}
    names: dict[str, str] = {}
    for tenant_id in tenant_ids:
        tenant = await db.get(Tenant, tenant_id)
        if tenant is not None:
            names[tenant_id] = tenant.name

    return [
        PartnerCommissionRow(
            id=row.id,
            tenant_id=row.tenant_id,
            tenant_name=names.get(row.tenant_id, row.tenant_id[:8]),
            invoice_id=row.invoice_id,
            platform_fee_amount=row.platform_fee_amount,
            commission_percent=row.commission_percent,
            commission_amount=row.commission_amount,
            currency=row.currency,
            status=row.status,
            available_at=row.available_at,
            created_at=row.created_at,
        )
        for row in commissions
    ]


@router.get("/payouts", response_model=list[PartnerPayoutRow])
async def partner_payouts(
    current_user: User = Depends(require_affiliate_user),
    db: AsyncSession = Depends(get_db),
) -> list[PartnerPayoutRow]:
    service = PartnerService(db)
    partner = await service.get_by_user_id(current_user.id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner profile not found.")
    payouts = await service.list_payouts(partner.id)
    return [
        PartnerPayoutRow(
            id=item.id,
            amount_requested=item.amount_requested,
            amount_approved=item.amount_approved,
            destination_address=item.destination_address,
            network=item.network,
            currency=item.currency,
            status=item.status,
            review_comment=item.review_comment,
            created_at=item.created_at,
            processed_at=item.processed_at,
        )
        for item in payouts
    ]


@router.post("/payouts", response_model=PartnerPayoutRow, status_code=status.HTTP_201_CREATED)
async def create_partner_payout(
    payload: PartnerPayoutCreateRequest,
    current_user: User = Depends(require_affiliate_user),
    db: AsyncSession = Depends(get_db),
) -> PartnerPayoutRow:
    service = PartnerService(db)
    partner = await service.get_by_user_id(current_user.id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner profile not found.")
    try:
        payout = await service.create_payout_request(
            partner=partner,
            user_id=current_user.id,
            amount=payload.amount,
            destination_address=payload.destination_address,
            network=payload.network,
        )
    except PartnerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return PartnerPayoutRow(
        id=payout.id,
        amount_requested=payout.amount_requested,
        amount_approved=payout.amount_approved,
        destination_address=payout.destination_address,
        network=payout.network,
        currency=payout.currency,
        status=payout.status,
        review_comment=payout.review_comment,
        created_at=payout.created_at,
        processed_at=payout.processed_at,
    )
