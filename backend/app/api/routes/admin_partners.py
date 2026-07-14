from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_platform_permission, require_platform_permission
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.partner import (
    AdminPartnerDetailResponse,
    AdminPartnerListItem,
    AdminPartnerPayoutReviewRequest,
    AdminPartnerUpdateRequest,
    AdminTenantReferralUpdateRequest,
    AffiliateSettingsResponse,
    AffiliateSettingsUpdateRequest,
    PartnerCommissionRow,
    PartnerMerchantRow,
    PartnerPayoutRow,
)
from app.services.partner_service import PartnerService, PartnerServiceError

router = APIRouter()


async def _to_list_item(service: PartnerService, partner, user: User) -> AdminPartnerListItem:
    balances = await service.balances(partner.id)
    funnel = await service.funnel_stats(partner.id)
    effective = await service.effective_commission_percent(partner)
    return AdminPartnerListItem(
        id=partner.id,
        user_id=partner.user_id,
        email=user.email,
        full_name=user.full_name,
        display_name=partner.display_name,
        status=partner.status,
        referral_code=partner.referral_code,
        commission_percent=partner.commission_percent,
        effective_commission_percent=effective,
        contact_telegram=partner.contact_telegram,
        payout_address=partner.payout_address,
        payout_network=partner.payout_network,
        pending_hold_usdt=balances["pending_hold_usdt"],
        available_usdt=balances["available_usdt"],
        paid_usdt=balances["paid_usdt"],
        registrations=funnel["registrations"],
        created_at=partner.created_at,
        approved_at=partner.approved_at,
    )


@router.get("/settings", response_model=AffiliateSettingsResponse)
async def get_affiliate_settings(
    _: User = Depends(require_any_platform_permission("admin.partners.read", "admin.billing.read")),
    db: AsyncSession = Depends(get_db),
) -> AffiliateSettingsResponse:
    percent, hold_days, min_payout, cookie_days = await PartnerService(db).get_affiliate_settings()
    return AffiliateSettingsResponse(
        affiliate_commission_percent=percent,
        affiliate_hold_days=hold_days,
        affiliate_min_payout_usdt=min_payout,
        affiliate_cookie_days=cookie_days,
    )


@router.put("/settings", response_model=AffiliateSettingsResponse)
async def update_affiliate_settings(
    payload: AffiliateSettingsUpdateRequest,
    _: User = Depends(require_any_platform_permission("admin.partners.write", "admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> AffiliateSettingsResponse:
    await PartnerService(db).update_affiliate_settings(
        affiliate_commission_percent=payload.affiliate_commission_percent,
        affiliate_hold_days=payload.affiliate_hold_days,
        affiliate_min_payout_usdt=payload.affiliate_min_payout_usdt,
        affiliate_cookie_days=payload.affiliate_cookie_days,
    )
    return AffiliateSettingsResponse(
        affiliate_commission_percent=payload.affiliate_commission_percent,
        affiliate_hold_days=payload.affiliate_hold_days,
        affiliate_min_payout_usdt=payload.affiliate_min_payout_usdt,
        affiliate_cookie_days=payload.affiliate_cookie_days,
    )


@router.get("", response_model=list[AdminPartnerListItem])
async def list_partners(
    _: User = Depends(require_platform_permission("admin.partners.read")),
    db: AsyncSession = Depends(get_db),
) -> list[AdminPartnerListItem]:
    service = PartnerService(db)
    partners = await service.list_partners()
    items: list[AdminPartnerListItem] = []
    for partner in partners:
        user = await db.get(User, partner.user_id)
        if user is None:
            continue
        items.append(await _to_list_item(service, partner, user))
    return items


@router.get("/payouts", response_model=list[PartnerPayoutRow])
async def list_partner_payouts(
    _: User = Depends(require_platform_permission("admin.partners.read")),
    db: AsyncSession = Depends(get_db),
) -> list[PartnerPayoutRow]:
    payouts = await PartnerService(db).list_payouts()
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


@router.post("/payouts/{payout_id}/review", response_model=PartnerPayoutRow)
async def review_partner_payout(
    payout_id: str,
    payload: AdminPartnerPayoutReviewRequest,
    current_user: User = Depends(require_platform_permission("admin.partners.write")),
    db: AsyncSession = Depends(get_db),
) -> PartnerPayoutRow:
    service = PartnerService(db)
    try:
        payout = await service.review_payout(
            payout_id=payout_id,
            reviewer_user_id=current_user.id,
            action=payload.action,
            amount_approved=payload.amount_approved,
            review_comment=payload.review_comment,
            external_reference=payload.external_reference,
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


@router.get("/{partner_id}", response_model=AdminPartnerDetailResponse)
async def get_partner_detail(
    partner_id: str,
    _: User = Depends(require_platform_permission("admin.partners.read")),
    db: AsyncSession = Depends(get_db),
) -> AdminPartnerDetailResponse:
    service = PartnerService(db)
    partner = await service.get_by_id(partner_id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")
    user = await db.get(User, partner.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner user not found.")

    base = await _to_list_item(service, partner, user)
    merchants = [PartnerMerchantRow(**row) for row in await service.list_merchants(partner.id)]
    commissions = await service.list_commissions(partner.id, limit=50)
    tenant_ids = {row.tenant_id for row in commissions}
    tenant_names: dict[str, str] = {}
    for tid in tenant_ids:
        tenant = await db.get(Tenant, tid)
        tenant_names[tid] = tenant.name if tenant is not None else tid[:8]

    commission_rows = [
        PartnerCommissionRow(
            id=row.id,
            tenant_id=row.tenant_id,
            tenant_name=tenant_names.get(row.tenant_id, row.tenant_id[:8]),
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
    payouts = [
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
        for item in await service.list_payouts(partner.id)
    ]
    return AdminPartnerDetailResponse(
        **base.model_dump(),
        review_comment=partner.review_comment,
        notes=partner.notes,
        merchants=merchants,
        recent_commissions=commission_rows,
        payouts=payouts,
    )


@router.patch("/{partner_id}", response_model=AdminPartnerListItem)
async def update_partner(
    partner_id: str,
    payload: AdminPartnerUpdateRequest,
    _: User = Depends(require_platform_permission("admin.partners.write")),
    db: AsyncSession = Depends(get_db),
) -> AdminPartnerListItem:
    service = PartnerService(db)
    try:
        partner = await service.admin_update_partner(
            partner_id,
            status=payload.status,
            commission_percent=payload.commission_percent,
            clear_commission_override=payload.clear_commission_override,
            review_comment=payload.review_comment,
            notes=payload.notes,
            payout_address=payload.payout_address,
            payout_network=payload.payout_network,
        )
    except PartnerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    user = await db.get(User, partner.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner user not found.")
    return await _to_list_item(service, partner, user)


@router.post("/{partner_id}/commissions/{commission_id}/clawback", response_model=PartnerCommissionRow)
async def clawback_commission(
    partner_id: str,
    commission_id: str,
    _: User = Depends(require_platform_permission("admin.partners.write")),
    db: AsyncSession = Depends(get_db),
) -> PartnerCommissionRow:
    service = PartnerService(db)
    try:
        row = await service.clawback_commission(commission_id)
    except PartnerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if row.partner_id != partner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commission not found.")
    tenant = await db.get(Tenant, row.tenant_id)
    return PartnerCommissionRow(
        id=row.id,
        tenant_id=row.tenant_id,
        tenant_name=tenant.name if tenant else row.tenant_id[:8],
        invoice_id=row.invoice_id,
        platform_fee_amount=row.platform_fee_amount,
        commission_percent=row.commission_percent,
        commission_amount=row.commission_amount,
        currency=row.currency,
        status=row.status,
        available_at=row.available_at,
        created_at=row.created_at,
    )


@router.put("/tenants/{tenant_id}/referral", response_model=dict)
async def set_tenant_referral(
    tenant_id: str,
    payload: AdminTenantReferralUpdateRequest,
    _: User = Depends(require_platform_permission("admin.partners.write")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    service = PartnerService(db)
    try:
        tenant = await service.set_tenant_referral(tenant_id, payload.referral_partner_id)
    except PartnerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {
        "tenant_id": tenant.id,
        "referral_partner_id": tenant.referral_partner_id,
    }
