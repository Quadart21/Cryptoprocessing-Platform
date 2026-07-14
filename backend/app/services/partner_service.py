from __future__ import annotations

import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.tenant import set_db_security_context
from app.models.partner import Partner, PartnerCommission, PartnerPayoutRequest, PartnerReferralEvent
from app.models.tenant import Tenant
from app.models.transaction import Transaction
from app.models.user import User
from app.services.billing_policy_service import BillingPolicyService


class PartnerServiceError(Exception):
    pass


class PartnerService:
    SETTLEMENT_PRECISION = Decimal("0.00000001")
    CODE_ALPHABET = string.ascii_uppercase + string.digits

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_affiliate_settings(self) -> tuple[Decimal, int, Decimal, int]:
        settings = await BillingPolicyService(self.db).get_platform_settings()
        return (
            Decimal(settings.affiliate_commission_percent),
            int(settings.affiliate_hold_days),
            Decimal(settings.affiliate_min_payout_usdt),
            int(settings.affiliate_cookie_days),
        )

    async def update_affiliate_settings(
        self,
        *,
        affiliate_commission_percent: Decimal,
        affiliate_hold_days: int,
        affiliate_min_payout_usdt: Decimal,
        affiliate_cookie_days: int,
    ):
        settings = await BillingPolicyService(self.db).get_platform_settings()
        settings.affiliate_commission_percent = affiliate_commission_percent
        settings.affiliate_hold_days = affiliate_hold_days
        settings.affiliate_min_payout_usdt = affiliate_min_payout_usdt
        settings.affiliate_cookie_days = affiliate_cookie_days
        self.db.add(settings)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    async def effective_commission_percent(self, partner: Partner) -> Decimal:
        default_percent, _, _, _ = await self.get_affiliate_settings()
        if partner.commission_percent is not None:
            return Decimal(partner.commission_percent)
        return default_percent

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
        normalized_email = email.strip().lower()
        existing = await self.db.scalar(select(User).where(User.email == normalized_email))
        if existing is not None:
            raise PartnerServiceError("Email is already registered.")

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

        partner = Partner(
            user_id=user.id,
            referral_code=await self._generate_unique_code(),
            display_name=display_name.strip(),
            contact_telegram=(contact_telegram or "").strip() or None,
            status="pending",
            payout_address=(payout_address or "").strip() or None,
            payout_network=(payout_network or "TRC20").strip().upper() or "TRC20",
        )
        self.db.add(partner)
        await self.db.commit()
        await self.db.refresh(partner)
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
        partner = await self.get_by_referral_code(referral_code)
        if partner is None or partner.status not in {"approved", "pending"}:
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
        partner = await self.get_by_referral_code(referral_code)
        if partner is None or partner.status != "approved":
            return None
        user = await self.db.get(User, partner.user_id)
        if user is None:
            return None
        if self._is_self_referral(partner_email=user.email, merchant_email=owner_email):
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
        user = await self.db.get(User, partner.user_id)
        if user is not None and self._is_self_referral(
            partner_email=user.email, merchant_email=owner_email
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
        tenant = await self.db.get(Tenant, tenant_id)
        if tenant is None:
            raise PartnerServiceError("Tenant not found.")
        if partner_id:
            partner = await self.get_by_id(partner_id)
            if partner is None:
                raise PartnerServiceError("Partner not found.")
            if partner.status != "approved":
                raise PartnerServiceError("Partner must be approved.")
            tenant.referral_partner_id = partner.id
        else:
            tenant.referral_partner_id = None
        self.db.add(tenant)
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant

    async def accrue_commission_for_settlement(
        self,
        *,
        tenant_id: str,
        invoice_id: str,
        transaction: Transaction,
        platform_fee: Decimal,
    ) -> PartnerCommission | None:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        if platform_fee <= 0:
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

        partner = await self.get_by_id(tenant.referral_partner_id)
        if partner is None or partner.status != "approved":
            return None

        commission_percent = await self.effective_commission_percent(partner)
        if commission_percent <= 0:
            return None

        _, hold_days, _, _ = await self.get_affiliate_settings()
        now = datetime.now(timezone.utc)
        commission_amount = (
            Decimal(platform_fee) * commission_percent / Decimal("100")
        ).quantize(self.SETTLEMENT_PRECISION)

        if commission_amount <= 0:
            return None

        row = PartnerCommission(
            partner_id=partner.id,
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            transaction_id=transaction.id,
            platform_fee_amount=Decimal(platform_fee).quantize(self.SETTLEMENT_PRECISION),
            commission_percent=commission_percent,
            commission_amount=commission_amount,
            currency="USDT",
            status="pending_hold",
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
        for tenant in tenants:
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
                    "tenant_name": tenant.name,
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
        if partner.status != "approved":
            raise PartnerServiceError("Partner is not approved.")

        await self.release_matured_holds(partner.id)
        balances = await self.balances(partner.id)
        available = balances["available_usdt"]
        _, _, min_payout, _ = await self.get_affiliate_settings()

        request_amount = Decimal(amount) if amount is not None else available
        request_amount = request_amount.quantize(self.SETTLEMENT_PRECISION)
        if request_amount <= 0:
            raise PartnerServiceError("Nothing available to withdraw.")
        if request_amount > available:
            raise PartnerServiceError("Requested amount exceeds available balance.")
        if request_amount < min_payout:
            raise PartnerServiceError(f"Minimum payout is {min_payout} USDT.")

        dest = (destination_address or partner.payout_address or "").strip()
        if not dest:
            raise PartnerServiceError("Set a payout address first.")
        net = (network or partner.payout_network or "TRC20").strip().upper()

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

        if clear_commission_override:
            partner.commission_percent = None
        elif commission_percent is not None:
            partner.commission_percent = commission_percent

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

    def _normalize_code(self, code: str) -> str:
        return re.sub(r"[^A-Za-z0-9]", "", (code or "").strip()).upper()

    async def _generate_unique_code(self) -> str:
        for _ in range(20):
            code = "".join(secrets.choice(self.CODE_ALPHABET) for _ in range(8))
            exists = await self.db.scalar(
                select(Partner.id).where(Partner.referral_code == code)
            )
            if exists is None:
                return code
        raise PartnerServiceError("Could not generate referral code.")

    @staticmethod
    def _is_self_referral(*, partner_email: str, merchant_email: str) -> bool:
        left = (partner_email or "").strip().lower()
        right = (merchant_email or "").strip().lower()
        if not left or not right:
            return False
        if left == right:
            return True
        left_domain = left.split("@")[-1]
        right_domain = right.split("@")[-1]
        # Block same-domain self-referral except common mail hosts.
        shared_free = {
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
        }
        if left_domain and left_domain == right_domain and left_domain not in shared_free:
            return True
        return False
