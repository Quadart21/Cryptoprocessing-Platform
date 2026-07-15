from __future__ import annotations

import json
import logging
import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.tenant import set_db_security_context
from app.models.partner import Partner, PartnerCommission, PartnerPayoutRequest, PartnerReferralEvent
from app.models.tenant import Tenant
from app.models.transaction import Transaction
from app.models.user import User
from app.services.affiliate_config import (
    AffiliateProgramConfig,
    config_from_payload,
    parse_affiliate_config,
)
from app.services.billing_policy_service import BillingPolicyService
from app.services.notification_service import NotificationService
from app.services.platform_ops_notify import notify_platform_ops

logger = logging.getLogger(__name__)


class PartnerServiceError(Exception):
    pass


class PartnerService:
    SETTLEMENT_PRECISION = Decimal("0.00000001")
    CODE_ALPHABET = string.ascii_uppercase + string.digits

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_program_config(self) -> AffiliateProgramConfig:
        settings = await BillingPolicyService(self.db).get_platform_settings()
        return parse_affiliate_config(
            getattr(settings, "affiliate_settings_json", None),
            legacy_commission_percent=Decimal(settings.affiliate_commission_percent),
            legacy_hold_days=int(settings.affiliate_hold_days),
            legacy_min_payout_usdt=Decimal(settings.affiliate_min_payout_usdt),
            legacy_cookie_days=int(settings.affiliate_cookie_days),
        )

    async def get_affiliate_settings(self) -> tuple[Decimal, int, Decimal, int]:
        cfg = await self.get_program_config()
        return (
            cfg.commission_percent,
            cfg.hold_days,
            cfg.min_payout_usdt,
            cfg.cookie_days,
        )

    async def update_affiliate_settings(
        self,
        *,
        affiliate_commission_percent: Decimal | None = None,
        affiliate_hold_days: int | None = None,
        affiliate_min_payout_usdt: Decimal | None = None,
        affiliate_cookie_days: int | None = None,
        config: dict | None = None,
    ):
        current = await self.get_program_config()
        if config is not None:
            merged = current.to_storage_dict()
            merged.update(config)
            next_cfg = config_from_payload(merged)
        else:
            next_cfg = current
            if affiliate_commission_percent is not None:
                next_cfg.commission_percent = Decimal(affiliate_commission_percent)
            if affiliate_hold_days is not None:
                next_cfg.hold_days = int(affiliate_hold_days)
            if affiliate_min_payout_usdt is not None:
                next_cfg.min_payout_usdt = Decimal(affiliate_min_payout_usdt)
            if affiliate_cookie_days is not None:
                next_cfg.cookie_days = int(affiliate_cookie_days)
            # Re-parse to apply clamps/validation.
            next_cfg = config_from_payload(next_cfg.to_storage_dict())

        settings = await BillingPolicyService(self.db).get_platform_settings()
        settings.affiliate_settings_json = json.dumps(next_cfg.to_storage_dict(), sort_keys=True)
        settings.affiliate_commission_percent = next_cfg.commission_percent
        settings.affiliate_hold_days = next_cfg.hold_days
        settings.affiliate_min_payout_usdt = next_cfg.min_payout_usdt
        settings.affiliate_cookie_days = next_cfg.cookie_days
        self.db.add(settings)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    async def effective_commission_percent(self, partner: Partner) -> Decimal:
        cfg = await self.get_program_config()
        if partner.commission_percent is not None and cfg.commission_override_allowed:
            value = Decimal(partner.commission_percent)
            lo = cfg.commission_override_min_percent
            hi = cfg.commission_override_max_percent
            if value < lo:
                return lo
            if value > hi:
                return hi
            return value
        return cfg.commission_percent

    async def get_by_user_id(self, user_id: str) -> Partner | None:
        return await self.db.scalar(select(Partner).where(Partner.user_id == user_id))

    async def get_by_id(self, partner_id: str) -> Partner | None:
        return await self.db.get(Partner, partner_id)

    async def get_by_referral_code(self, code: str) -> Partner | None:
        normalized = self._normalize_code(code)
        if not normalized:
            return None
        return await self.db.scalar(
            select(Partner).where(Partner.referral_code == normalized)
        )

    async def apply(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        display_name: str,
        contact_telegram: str | None,
        payout_address: str | None,
        payout_network: str,
    ) -> Partner:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        cfg = await self.get_program_config()
        if not cfg.program_enabled or not cfg.public_apply_enabled:
            raise PartnerServiceError("Affiliate applications are currently closed.")

        normalized_email = email.strip().lower()
        existing = await self.db.scalar(select(User).where(User.email == normalized_email))
        if existing is not None:
            raise PartnerServiceError("Email is already registered.")

        dest = (payout_address or "").strip() or None
        if cfg.require_payout_address_on_apply and not dest:
            raise PartnerServiceError("Payout address is required for application.")

        net = (payout_network or cfg.default_payout_network or "TRC20").strip().upper() or "TRC20"
        if net not in cfg.allowed_payout_networks:
            raise PartnerServiceError(
                f"Payout network must be one of: {', '.join(cfg.allowed_payout_networks)}."
            )

        user = User(
            tenant_id=None,
            email=normalized_email,
            password_hash=get_password_hash(password),
            full_name=full_name.strip(),
            role="affiliate",
            status="active",
            invited_at=datetime.now(timezone.utc),
            activated_at=datetime.now(timezone.utc),
        )
        self.db.add(user)
        await self.db.flush()

        now = datetime.now(timezone.utc)
        partner = Partner(
            user_id=user.id,
            referral_code=await self._generate_unique_code(cfg.referral_code_length),
            display_name=display_name.strip(),
            contact_telegram=(contact_telegram or "").strip() or None,
            status="approved" if cfg.auto_approve_partners else "pending",
            payout_address=dest,
            payout_network=net,
            approved_at=now if cfg.auto_approve_partners else None,
        )
        self.db.add(partner)
        await self.db.commit()
        await self.db.refresh(partner)
        await self.notify_partner_application_submitted(partner)
        if partner.status == "approved":
            await self.notify_partner_status_changed(partner, previous_status="pending")
        return partner

    async def record_click(
        self,
        *,
        referral_code: str,
        ip_address: str | None,
        user_agent: str | None,
        landing_path: str | None,
    ) -> PartnerReferralEvent | None:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        cfg = await self.get_program_config()
        if not cfg.program_enabled:
            return None
        partner = await self.get_by_referral_code(referral_code)
        if partner is None:
            return None
        allowed_statuses = {"approved"}
        if cfg.track_clicks_from_pending_partners:
            allowed_statuses.add("pending")
        if partner.status not in allowed_statuses:
            return None
        event = PartnerReferralEvent(
            partner_id=partner.id,
            event_type="click",
            referral_code=partner.referral_code,
            ip_address=ip_address,
            user_agent=(user_agent or "")[:500] or None,
            landing_path=(landing_path or "")[:500] or None,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def resolve_partner_for_registration(
        self,
        *,
        referral_code: str | None,
        owner_email: str,
    ) -> Partner | None:
        if not referral_code:
            return None
        cfg = await self.get_program_config()
        if not cfg.program_enabled:
            return None
        partner = await self.get_by_referral_code(referral_code)
        if partner is None:
            return None
        if cfg.require_approved_partner_for_attribution and partner.status != "approved":
            return None
        if partner.status in {"rejected", "suspended"}:
            return None
        user = await self.db.get(User, partner.user_id)
        if user is None:
            return None
        if self._is_self_referral(
            partner_email=user.email,
            merchant_email=owner_email,
            cfg=cfg,
        ):
            return None
        return partner

    async def attach_tenant_referral(
        self,
        *,
        tenant: Tenant,
        partner: Partner | None,
        owner_email: str,
    ) -> None:
        if partner is None:
            return
        cfg = await self.get_program_config()
        user = await self.db.get(User, partner.user_id)
        if user is not None and self._is_self_referral(
            partner_email=user.email,
            merchant_email=owner_email,
            cfg=cfg,
        ):
            return
        tenant.referral_partner_id = partner.id
        self.db.add(
            PartnerReferralEvent(
                partner_id=partner.id,
                event_type="registration",
                referral_code=partner.referral_code,
                tenant_id=tenant.id,
            )
        )

    async def set_tenant_referral(
        self, tenant_id: str, partner_id: str | None
    ) -> Tenant:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        cfg = await self.get_program_config()
        tenant = await self.db.get(Tenant, tenant_id)
        if tenant is None:
            raise PartnerServiceError("Tenant not found.")
        if (
            partner_id
            and cfg.freeze_attribution_after_tenant_approve
            and tenant.status == "approved"
            and tenant.referral_partner_id
            and tenant.referral_partner_id != partner_id
        ):
            # Still allow admin override, but signal via exception only if desired.
            # Admin endpoint intentionally bypasses freeze.
            pass
        previous_partner_id = tenant.referral_partner_id
        attributed_partner: Partner | None = None
        if partner_id:
            partner = await self.get_by_id(partner_id)
            if partner is None:
                raise PartnerServiceError("Partner not found.")
            if cfg.require_approved_partner_for_attribution and partner.status != "approved":
                raise PartnerServiceError("Partner must be approved.")
            tenant.referral_partner_id = partner.id
            attributed_partner = partner
        else:
            tenant.referral_partner_id = None
        self.db.add(tenant)
        await self.db.commit()
        await self.db.refresh(tenant)
        if attributed_partner is not None and attributed_partner.id != previous_partner_id:
            await self.notify_partner_merchant_attributed(attributed_partner, tenant)
        return tenant

    async def attribution_still_active(self, tenant: Tenant) -> bool:
        cfg = await self.get_program_config()
        if cfg.attribution_mode != "fixed_days":
            return True
        if tenant.created_at is None:
            return True
        created = tenant.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        expires = created + timedelta(days=cfg.attribution_days)
        return datetime.now(timezone.utc) <= expires

    async def accrue_commission_for_settlement(
        self,
        *,
        tenant_id: str,
        invoice_id: str,
        transaction: Transaction,
        platform_fee: Decimal,
    ) -> PartnerCommission | None:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        cfg = await self.get_program_config()
        if not cfg.program_enabled:
            return None
        if platform_fee <= 0:
            return None
        if Decimal(platform_fee) < cfg.min_platform_fee_to_accrue_usdt:
            return None

        existing = await self.db.scalar(
            select(PartnerCommission.id).where(
                PartnerCommission.transaction_id == transaction.id
            )
        )
        if existing is not None:
            return None

        tenant = await self.db.get(Tenant, tenant_id)
        if tenant is None or not tenant.referral_partner_id:
            return None
        if cfg.accrue_only_approved_tenants and tenant.status != "approved":
            return None
        if not await self.attribution_still_active(tenant):
            return None

        partner = await self.get_by_id(tenant.referral_partner_id)
        if partner is None:
            return None
        if cfg.accrue_only_approved_partners and partner.status != "approved":
            return None
        if partner.status == "suspended":
            return None

        commission_percent = await self.effective_commission_percent(partner)
        if commission_percent <= 0:
            return None

        now = datetime.now(timezone.utc)
        commission_amount = (
            Decimal(platform_fee) * commission_percent / Decimal("100")
        ).quantize(self.SETTLEMENT_PRECISION)

        if commission_amount <= 0:
            return None

        hold_days = cfg.hold_days
        row = PartnerCommission(
            partner_id=partner.id,
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            transaction_id=transaction.id,
            platform_fee_amount=Decimal(platform_fee).quantize(self.SETTLEMENT_PRECISION),
            commission_percent=commission_percent,
            commission_amount=commission_amount,
            currency="USDT",
            status="pending_hold" if hold_days > 0 else "available",
            available_at=now + timedelta(days=hold_days),
        )
        self.db.add(row)
        await self.db.flush()
        return row

    async def release_matured_holds(self, partner_id: str | None = None) -> int:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        now = datetime.now(timezone.utc)
        stmt = select(PartnerCommission).where(
            PartnerCommission.status == "pending_hold",
            PartnerCommission.available_at <= now,
        )
        if partner_id:
            stmt = stmt.where(PartnerCommission.partner_id == partner_id)
        rows = list((await self.db.scalars(stmt)).all())
        for row in rows:
            row.status = "available"
            self.db.add(row)
        if rows:
            await self.db.flush()
        return len(rows)

    async def balances(self, partner_id: str) -> dict[str, Decimal]:
        await self.release_matured_holds(partner_id)
        rows = list(
            (
                await self.db.scalars(
                    select(PartnerCommission).where(PartnerCommission.partner_id == partner_id)
                )
            ).all()
        )
        pending = Decimal("0")
        available = Decimal("0")
        locked = Decimal("0")
        paid = Decimal("0")
        for row in rows:
            amount = Decimal(row.commission_amount)
            if row.status == "pending_hold":
                pending += amount
            elif row.status == "available":
                available += amount
            elif row.status == "locked_payout":
                locked += amount
            elif row.status == "paid":
                paid += amount
        return {
            "pending_hold_usdt": pending,
            "available_usdt": available,
            "locked_payout_usdt": locked,
            "paid_usdt": paid,
        }

    async def funnel_stats(self, partner_id: str) -> dict[str, int]:
        clicks = await self.db.scalar(
            select(func.count())
            .select_from(PartnerReferralEvent)
            .where(
                PartnerReferralEvent.partner_id == partner_id,
                PartnerReferralEvent.event_type == "click",
            )
        )
        registrations = await self.db.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.referral_partner_id == partner_id)
        )
        approved = await self.db.scalar(
            select(func.count())
            .select_from(Tenant)
            .where(
                Tenant.referral_partner_id == partner_id,
                Tenant.status == "approved",
            )
        )
        with_volume = await self.db.scalar(
            select(func.count(func.distinct(PartnerCommission.tenant_id))).where(
                PartnerCommission.partner_id == partner_id
            )
        )
        return {
            "clicks": int(clicks or 0),
            "registrations": int(registrations or 0),
            "approved_merchants": int(approved or 0),
            "merchants_with_volume": int(with_volume or 0),
        }

    async def list_merchants(self, partner_id: str) -> list[dict]:
        cfg = await self.get_program_config()
        tenants = list(
            (
                await self.db.scalars(
                    select(Tenant)
                    .where(Tenant.referral_partner_id == partner_id)
                    .order_by(Tenant.created_at.desc())
                )
            ).all()
        )
        result = []
        for index, tenant in enumerate(tenants, start=1):
            fee_sum = await self.db.scalar(
                select(func.coalesce(func.sum(PartnerCommission.platform_fee_amount), 0)).where(
                    PartnerCommission.partner_id == partner_id,
                    PartnerCommission.tenant_id == tenant.id,
                    PartnerCommission.status != "clawed_back",
                )
            )
            commission_sum = await self.db.scalar(
                select(func.coalesce(func.sum(PartnerCommission.commission_amount), 0)).where(
                    PartnerCommission.partner_id == partner_id,
                    PartnerCommission.tenant_id == tenant.id,
                    PartnerCommission.status != "clawed_back",
                )
            )
            result.append(
                {
                    "tenant_id": tenant.id,
                    "tenant_name": (
                        tenant.name
                        if cfg.show_merchant_names_to_partners
                        else f"Клиент #{index}"
                    ),
                    "tenant_status": tenant.status,
                    "created_at": tenant.created_at,
                    "platform_fee_usdt": Decimal(fee_sum or 0),
                    "commission_usdt": Decimal(commission_sum or 0),
                }
            )
        return result

    async def list_commissions(self, partner_id: str, limit: int = 100) -> list[PartnerCommission]:
        await self.release_matured_holds(partner_id)
        return list(
            (
                await self.db.scalars(
                    select(PartnerCommission)
                    .where(PartnerCommission.partner_id == partner_id)
                    .order_by(PartnerCommission.created_at.desc())
                    .limit(limit)
                )
            ).all()
        )

    async def update_profile(
        self,
        partner: Partner,
        *,
        display_name: str | None,
        contact_telegram: str | None,
        payout_address: str | None,
        payout_network: str | None,
    ) -> Partner:
        if display_name is not None:
            partner.display_name = display_name.strip()
        if contact_telegram is not None:
            partner.contact_telegram = contact_telegram.strip() or None
        if payout_address is not None:
            partner.payout_address = payout_address.strip() or None
        if payout_network is not None:
            partner.payout_network = payout_network.strip().upper() or "TRC20"
        self.db.add(partner)
        await self.db.commit()
        await self.db.refresh(partner)
        return partner

    async def create_payout_request(
        self,
        *,
        partner: Partner,
        user_id: str,
        amount: Decimal | None,
        destination_address: str | None,
        network: str | None,
    ) -> PartnerPayoutRequest:
        cfg = await self.get_program_config()
        if not cfg.program_enabled or not cfg.payouts_enabled:
            raise PartnerServiceError("Affiliate payouts are currently disabled.")
        if partner.status != "approved":
            raise PartnerServiceError("Partner is not approved.")

        await self.release_matured_holds(partner.id)
        balances = await self.balances(partner.id)
        available = balances["available_usdt"]
        min_payout = cfg.min_payout_usdt

        request_amount = Decimal(amount) if amount is not None else available
        request_amount = request_amount.quantize(self.SETTLEMENT_PRECISION)
        if request_amount <= 0:
            raise PartnerServiceError("Nothing available to withdraw.")
        if request_amount > available:
            raise PartnerServiceError("Requested amount exceeds available balance.")
        if request_amount < min_payout:
            raise PartnerServiceError(f"Minimum payout is {min_payout} USDT.")

        dest = (destination_address or partner.payout_address or "").strip()
        if cfg.require_payout_address_before_request and not dest:
            raise PartnerServiceError("Set a payout address first.")
        if not dest:
            raise PartnerServiceError("Set a payout address first.")
        net = (
            network or partner.payout_network or cfg.default_payout_network or "TRC20"
        ).strip().upper()
        if net not in cfg.allowed_payout_networks:
            raise PartnerServiceError(
                f"Payout network must be one of: {', '.join(cfg.allowed_payout_networks)}."
            )

        payout = PartnerPayoutRequest(
            partner_id=partner.id,
            requested_by_user_id=user_id,
            destination_address=dest,
            network=net,
            currency="USDT",
            amount_requested=request_amount,
            status="pending_review",
        )
        self.db.add(payout)
        await self.db.flush()

        # Lock commissions FIFO until amount covered.
        remaining = request_amount
        commissions = list(
            (
                await self.db.scalars(
                    select(PartnerCommission)
                    .where(
                        PartnerCommission.partner_id == partner.id,
                        PartnerCommission.status == "available",
                    )
                    .order_by(PartnerCommission.available_at.asc(), PartnerCommission.created_at.asc())
                )
            ).all()
        )
        locked_sum = Decimal("0")
        for row in commissions:
            if remaining <= 0:
                break
            row.status = "locked_payout"
            row.payout_request_id = payout.id
            amount = Decimal(row.commission_amount)
            remaining -= amount
            locked_sum += amount
            self.db.add(row)

        if locked_sum <= 0:
            await self.db.rollback()
            raise PartnerServiceError("Could not lock enough commission rows.")

        # Commission rows are atomic; payout equals locked sum (may round up vs request).
        payout.amount_requested = locked_sum.quantize(self.SETTLEMENT_PRECISION)
        self.db.add(payout)

        partner.payout_address = dest
        partner.payout_network = net
        self.db.add(partner)
        await self.db.commit()
        await self.db.refresh(payout)
        await self.notify_partner_payout_event(
            partner,
            payout,
            event_code=NotificationService.EVENT_PARTNER_PAYOUT_REQUESTED,
            subject="Partner payout request created",
        )
        await notify_platform_ops(
            self.db,
            event_code="partner_payout_requested",
            title="Заявка на выплату партнёру",
            lines=[
                f"Партнёр: {partner.display_name}",
                f"Сумма: {payout.amount_requested} {payout.currency}",
                f"Адрес: {payout.destination_address}",
                f"Payout ID: {payout.id}",
            ],
            admin_url="/admin/partners",
        )
        return payout

    async def list_payouts(self, partner_id: str | None = None) -> list[PartnerPayoutRequest]:
        stmt = select(PartnerPayoutRequest).order_by(PartnerPayoutRequest.created_at.desc())
        if partner_id:
            stmt = stmt.where(PartnerPayoutRequest.partner_id == partner_id)
        return list((await self.db.scalars(stmt)).all())

    async def review_payout(
        self,
        *,
        payout_id: str,
        reviewer_user_id: str,
        action: str,
        amount_approved: Decimal | None,
        review_comment: str | None,
        external_reference: str | None,
    ) -> PartnerPayoutRequest:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        payout = await self.db.get(PartnerPayoutRequest, payout_id)
        if payout is None:
            raise PartnerServiceError("Payout request not found.")
        if payout.status != "pending_review":
            raise PartnerServiceError("Payout already reviewed.")

        locked = list(
            (
                await self.db.scalars(
                    select(PartnerCommission).where(
                        PartnerCommission.payout_request_id == payout.id,
                        PartnerCommission.status == "locked_payout",
                    )
                )
            ).all()
        )

        if action == "reject":
            for row in locked:
                row.status = "available"
                row.payout_request_id = None
                self.db.add(row)
            payout.status = "rejected"
            payout.review_comment = review_comment
            payout.reviewed_by_user_id = reviewer_user_id
            payout.processed_at = datetime.now(timezone.utc)
            self.db.add(payout)
            await self.db.commit()
            await self.db.refresh(payout)
            partner = await self.get_by_id(payout.partner_id)
            if partner is not None:
                await self.notify_partner_payout_event(
                    partner,
                    payout,
                    event_code=NotificationService.EVENT_PARTNER_PAYOUT_REJECTED,
                    subject="Partner payout rejected",
                    force_email=True,
                )
            return payout

        if action != "approve":
            raise PartnerServiceError("Unsupported action.")

        approved = Decimal(amount_approved or payout.amount_requested).quantize(
            self.SETTLEMENT_PRECISION
        )
        locked_sum = sum((Decimal(row.commission_amount) for row in locked), Decimal("0"))
        if approved > locked_sum + self.SETTLEMENT_PRECISION:
            raise PartnerServiceError("Approved amount exceeds locked commissions.")

        for row in locked:
            row.status = "paid"
            self.db.add(row)

        payout.status = "approved"
        payout.amount_approved = approved
        payout.review_comment = review_comment
        payout.external_reference = external_reference
        payout.reviewed_by_user_id = reviewer_user_id
        payout.processed_at = datetime.now(timezone.utc)
        self.db.add(payout)
        await self.db.commit()
        await self.db.refresh(payout)
        partner = await self.get_by_id(payout.partner_id)
        if partner is not None:
            await self.notify_partner_payout_event(
                partner,
                payout,
                event_code=NotificationService.EVENT_PARTNER_PAYOUT_APPROVED,
                subject="Partner payout approved",
                force_email=True,
            )
        return payout

    async def admin_update_partner(
        self,
        partner_id: str,
        *,
        status: str | None,
        commission_percent: Decimal | None,
        clear_commission_override: bool,
        review_comment: str | None,
        notes: str | None,
        payout_address: str | None,
        payout_network: str | None,
    ) -> Partner:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        partner = await self.get_by_id(partner_id)
        if partner is None:
            raise PartnerServiceError("Partner not found.")

        previous_status = partner.status
        if status is not None:
            normalized = status.strip().lower()
            if normalized not in {"pending", "approved", "rejected", "suspended"}:
                raise PartnerServiceError("Invalid partner status.")
            partner.status = normalized
            if normalized == "approved":
                partner.approved_at = partner.approved_at or datetime.now(timezone.utc)
                partner.suspended_at = None
                user = await self.db.get(User, partner.user_id)
                if user is not None and user.status != "active":
                    user.status = "active"
                    self.db.add(user)
            elif normalized == "suspended":
                partner.suspended_at = datetime.now(timezone.utc)
            elif normalized == "rejected":
                partner.suspended_at = None

        cfg = await self.get_program_config()
        if clear_commission_override:
            partner.commission_percent = None
        elif commission_percent is not None:
            if not cfg.commission_override_allowed:
                raise PartnerServiceError("Commission overrides are disabled.")
            value = Decimal(commission_percent)
            if value < cfg.commission_override_min_percent or value > cfg.commission_override_max_percent:
                raise PartnerServiceError(
                    f"Commission override must be between "
                    f"{cfg.commission_override_min_percent} and {cfg.commission_override_max_percent}."
                )
            partner.commission_percent = value

        if review_comment is not None:
            partner.review_comment = review_comment
        if notes is not None:
            partner.notes = notes
        if payout_address is not None:
            partner.payout_address = payout_address.strip() or None
        if payout_network is not None:
            partner.payout_network = payout_network.strip().upper() or "TRC20"

        self.db.add(partner)
        await self.db.commit()
        await self.db.refresh(partner)
        if status is not None and partner.status != previous_status:
            await self.notify_partner_status_changed(partner, previous_status=previous_status)
        return partner

    async def list_partners(self) -> list[Partner]:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        return list(
            (
                await self.db.scalars(select(Partner).order_by(Partner.created_at.desc()))
            ).all()
        )

    async def clawback_commission(self, commission_id: str) -> PartnerCommission:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        row = await self.db.get(PartnerCommission, commission_id)
        if row is None:
            raise PartnerServiceError("Commission not found.")
        if row.status == "paid":
            raise PartnerServiceError("Cannot clawback a paid commission.")
        if row.status == "locked_payout":
            raise PartnerServiceError("Commission is locked in a payout request.")
        row.status = "clawed_back"
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return row

    async def notify_partner_application_submitted(self, partner: Partner) -> None:
        await self._notify_partner_user(
            partner,
            event_code=NotificationService.EVENT_PARTNER_APPLICATION_SUBMITTED,
            subject="Partner application received",
            lines=[
                f"Partner: {partner.display_name}",
                f"Referral code: {partner.referral_code}",
                f"Status: {partner.status}",
                "Your application is under review."
                if partner.status == "pending"
                else "Your partner account is ready.",
            ],
            context={
                "partner_display_name": partner.display_name,
                "referral_code": partner.referral_code,
                "partner_status": partner.status,
                "review_comment": partner.review_comment or "-",
            },
            force_email=True,
        )

    async def notify_partner_status_changed(
        self,
        partner: Partner,
        *,
        previous_status: str,
    ) -> None:
        if partner.status == previous_status:
            return
        if partner.status == "approved":
            event_code = NotificationService.EVENT_PARTNER_APPLICATION_APPROVED
            subject = "Partner account approved"
            lines = [
                f"Partner: {partner.display_name}",
                f"Referral code: {partner.referral_code}",
                "You can sign in and share your referral link.",
            ]
        elif partner.status == "rejected":
            event_code = NotificationService.EVENT_PARTNER_APPLICATION_REJECTED
            subject = "Partner application rejected"
            lines = [
                f"Partner: {partner.display_name}",
                f"Comment: {partner.review_comment or '-'}",
            ]
        elif partner.status == "suspended":
            event_code = NotificationService.EVENT_PARTNER_SUSPENDED
            subject = "Partner account suspended"
            lines = [
                f"Partner: {partner.display_name}",
                f"Referral code: {partner.referral_code}",
                f"Comment: {partner.review_comment or '-'}",
            ]
        else:
            return
        await self._notify_partner_user(
            partner,
            event_code=event_code,
            subject=subject,
            lines=lines,
            context={
                "partner_display_name": partner.display_name,
                "referral_code": partner.referral_code,
                "partner_status": partner.status,
                "review_comment": partner.review_comment or "-",
            },
            force_email=True,
        )
        ops_titles = {
            NotificationService.EVENT_PARTNER_APPLICATION_APPROVED: "Партнёр одобрен",
            NotificationService.EVENT_PARTNER_APPLICATION_REJECTED: "Партнёр отклонён",
            NotificationService.EVENT_PARTNER_SUSPENDED: "Партнёр приостановлен",
        }
        await notify_platform_ops(
            self.db,
            event_code=event_code,
            title=ops_titles.get(event_code, "Статус партнёра изменён"),
            lines=[
                f"Партнёр: {partner.display_name}",
                f"Код: {partner.referral_code}",
                f"Статус: {partner.status}",
                f"Комментарий: {partner.review_comment or '-'}",
            ],
            admin_url="/admin/partners",
        )

    async def notify_partner_merchant_attributed(
        self,
        partner: Partner,
        tenant: Tenant,
    ) -> None:
        await self._notify_partner_user(
            partner,
            event_code=NotificationService.EVENT_PARTNER_MERCHANT_ATTRIBUTED,
            subject="New referred merchant",
            lines=[
                f"Merchant: {tenant.name}",
                f"Referral code: {partner.referral_code}",
                "Commission accrues from platform fees after settlement.",
            ],
            context={
                "partner_display_name": partner.display_name,
                "referral_code": partner.referral_code,
                "partner_status": partner.status,
                "merchant_name": tenant.name,
                "tenant_name": tenant.name,
                "review_comment": "-",
            },
        )

    async def notify_partner_payout_event(
        self,
        partner: Partner,
        payout: PartnerPayoutRequest,
        *,
        event_code: str,
        subject: str,
        force_email: bool = False,
    ) -> None:
        amount = payout.amount_approved if payout.amount_approved is not None else payout.amount_requested
        await self._notify_partner_user(
            partner,
            event_code=event_code,
            subject=subject,
            lines=[
                f"Payout ID: {payout.id}",
                f"Amount: {amount} {payout.currency}",
                f"Address: {payout.destination_address}",
                f"Status: {payout.status}",
                f"Comment: {payout.review_comment or '-'}",
            ],
            context={
                "partner_display_name": partner.display_name,
                "referral_code": partner.referral_code,
                "partner_status": partner.status,
                "payout_id": payout.id,
                "payout_amount": str(amount),
                "payout_currency": payout.currency,
                "payout_status": payout.status,
                "destination_address": payout.destination_address,
                "review_comment": payout.review_comment or "-",
            },
            force_email=force_email,
        )

    async def _notify_partner_user(
        self,
        partner: Partner,
        *,
        event_code: str,
        subject: str,
        lines: Iterable[str],
        context: dict[str, Any] | None = None,
        force_email: bool = False,
    ) -> None:
        try:
            user = await self.db.get(User, partner.user_id)
            if user is None:
                return
            await NotificationService(self.db).notify_user(
                user,
                event_code=event_code,
                subject=subject,
                lines=lines,
                context=context,
                force_email=force_email,
            )
        except Exception:
            logger.exception(
                "Partner notification failed for partner=%s event=%s",
                partner.id,
                event_code,
            )

    def _normalize_code(self, code: str) -> str:
        return re.sub(r"[^A-Za-z0-9]", "", (code or "").strip()).upper()

    async def _generate_unique_code(self, length: int = 8) -> str:
        size = max(4, min(16, int(length or 8)))
        for _ in range(20):
            code = "".join(secrets.choice(self.CODE_ALPHABET) for _ in range(size))
            exists = await self.db.scalar(
                select(Partner.id).where(Partner.referral_code == code)
            )
            if exists is None:
                return code
        raise PartnerServiceError("Could not generate referral code.")

    @staticmethod
    def _is_self_referral(
        *,
        partner_email: str,
        merchant_email: str,
        cfg: AffiliateProgramConfig | None = None,
    ) -> bool:
        left = (partner_email or "").strip().lower()
        right = (merchant_email or "").strip().lower()
        if not left or not right:
            return False
        block_email = True if cfg is None else cfg.block_self_referral_email
        block_domain = True if cfg is None else cfg.block_same_email_domain
        free_domains = {
            item.lower()
            for item in (
                cfg.self_referral_free_domains
                if cfg is not None
                else [
                    "gmail.com",
                    "googlemail.com",
                    "yahoo.com",
                    "outlook.com",
                    "hotmail.com",
                    "icloud.com",
                    "mail.ru",
                    "yandex.ru",
                    "yandex.com",
                    "proton.me",
                    "protonmail.com",
                ]
            )
        }
        if block_email and left == right:
            return True
        left_domain = left.split("@")[-1]
        right_domain = right.split("@")[-1]
        if (
            block_domain
            and left_domain
            and left_domain == right_domain
            and left_domain not in free_domains
        ):
            return True
        return False
