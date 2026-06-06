from __future__ import annotations

import hashlib
import ipaddress
import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.tenant import apply_db_security_context, set_db_security_context
from app.models.api_key import ApiKey
from app.models.invite_token import InviteToken
from app.models.invoice import Invoice
from app.models.ledger_entry import LedgerEntry
from app.models.merchant_sandbox import MerchantSandbox
from app.models.payout_request import PayoutRequest
from app.models.project import Project
from app.models.provider_event import ProviderEvent
from app.models.sandbox_audit_log import SandboxAuditLog
from app.models.statistics_exclusion import StatisticsExclusion
from app.models.tenant import Tenant
from app.models.tenant_balance import TenantBalance
from app.models.tenant_fee_policy import TenantFeePolicy
from app.models.transaction import Transaction
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.project import ProjectCreateRequest
from app.services.accounting_service import AccountingService
from app.services.billing_policy_service import BillingPolicyService
from app.services.cloudflare_dns_service import CloudflareDnsError, CloudflareDnsService
from app.services.project_service import ProjectService
from app.services.tenant_service import TenantService

logger = logging.getLogger(__name__)

SUBDOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
ZONE_RE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$", re.IGNORECASE)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class SandboxCreateOutcome:
    sandbox: MerchantSandbox
    enrollment_token: str
    api_public_key: str
    api_secret_key: str
    owner_password: str
    owner_email: str


class SandboxService:
    ENROLLMENT_TTL = timedelta(hours=48)

    def __init__(self, db: AsyncSession):
        self.db = db

    def _append_audit(
        self,
        *,
        sandbox_id: str,
        admin_user_id: str | None,
        action: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        self.db.add(
            SandboxAuditLog(
                merchant_sandbox_id=sandbox_id,
                admin_user_id=admin_user_id,
                action=action,
                payload_json=payload,
            )
        )

    async def create_sandbox(
        self,
        *,
        admin_user_id: str,
        label: str,
        dns_parent_zone: str,
        desired_subdomain: str,
    ) -> SandboxCreateOutcome:
        label_n = label.strip()
        if len(label_n) < 2 or len(label_n) > 200:
            raise ValueError("Подпись песочницы: от 2 до 200 символов.")

        zone = dns_parent_zone.strip().lower().rstrip(".")
        if not ZONE_RE.match(zone):
            raise ValueError("Некорректное имя DNS-зоны (example.com).")

        sub = desired_subdomain.strip().lower()
        if not SUBDOMAIN_RE.match(sub):
            raise ValueError("Поддомен: только a-z, 0-9, дефис, до 63 символов.")

        dup = await self.db.scalar(
            select(MerchantSandbox.id).where(
                and_(
                    MerchantSandbox.dns_parent_zone == zone,
                    MerchantSandbox.desired_subdomain == sub,
                )
            )
        )
        if dup is not None:
            raise ValueError("Такой поддомен в этой зоне уже занят.")

        tenant_service = TenantService(self.db)
        slug_base = f"sandbox-{secrets.token_hex(4)}"
        slug = await tenant_service._build_unique_slug(slug_base)

        tenant = Tenant(
            name=f"Sandbox · {label_n}",
            slug=slug,
            status="approved",
            timezone="UTC",
            base_currency="USD",
            plan="sandbox",
            review_comment=None,
        )
        self.db.add(tenant)
        await self.db.flush()

        await set_db_security_context(self.db, tenant_id=tenant.id, is_superadmin=True)

        owner_password = TenantService._generate_secure_password(18)
        owner_email = f"sb.{tenant.id[:12].replace('-', '')}@sandbox.invalid"
        owner = User(
            tenant_id=tenant.id,
            email=owner_email,
            password_hash=get_password_hash(owner_password),
            full_name="Sandbox owner",
            role="tenant_owner",
            status="active",
            activated_at=datetime.now(timezone.utc),
        )
        self.db.add(owner)

        project_domain = f"{slug.replace('_', '-')}.sandbox.invalid"
        project_service = ProjectService(self.db)
        project = await project_service.create_project(
            tenant.id,
            ProjectCreateRequest(
                name=f"Sandbox project ({label_n})",
                domain=project_domain,
                description="Автоматически создан для изолированной песочницы.",
            ),
        )
        project.status = "active"

        api_key, api_secret = await project_service.create_api_key(tenant.id, project.id)

        enrollment_token = secrets.token_urlsafe(36)
        expires_at = datetime.now(timezone.utc) + self.ENROLLMENT_TTL

        sandbox = MerchantSandbox(
            tenant_id=tenant.id,
            project_id=project.id,
            label=label_n,
            dns_parent_zone=zone,
            desired_subdomain=sub,
            status="enrolling",
            enrollment_token_hash=_hash_token(enrollment_token),
            enrollment_expires_at=expires_at,
            created_by_user_id=admin_user_id,
        )
        self.db.add(sandbox)
        await self.db.flush()

        self.db.add(
            StatisticsExclusion(
                tenant_id=tenant.id,
                reason="sandbox",
                merchant_sandbox_id=sandbox.id,
            )
        )

        self._append_audit(
            sandbox_id=sandbox.id,
            admin_user_id=admin_user_id,
            action="sandbox_created",
            payload={
                "dns_zone": zone,
                "subdomain": sub,
                "tenant_id": tenant.id,
                "project_id": project.id,
            },
        )

        await self.db.commit()
        await apply_db_security_context(self.db)

        AccountingService.invalidate_cache()

        from app.services.platform_ops_notify import notify_platform_ops

        fqdn = f"{sub}.{zone}"
        await notify_platform_ops(
            self.db,
            event_code="sandbox_created",
            title="Создана песочница",
            lines=[
                f"Label: {label_n}",
                f"Sandbox ID: {sandbox.id}",
                f"FQDN: {fqdn}",
                f"Tenant: {tenant.name}",
            ],
            admin_url="/admin/sandbox",
        )

        return SandboxCreateOutcome(
            sandbox=sandbox,
            enrollment_token=enrollment_token,
            api_public_key=api_key.public_key,
            api_secret_key=api_secret,
            owner_password=owner_password,
            owner_email=owner_email,
        )

    async def enroll_agent(
        self,
        *,
        sandbox_id: str,
        enrollment_token: str,
        agent_instance_id: str | None,
    ) -> tuple[str, dict[str, str]]:
        sandbox = await self.db.get(MerchantSandbox, sandbox_id)
        if sandbox is None:
            raise ValueError("Песочница не найдена.")
        if sandbox.status not in {"enrolling", "draft", "failed"}:
            raise ValueError("Регистрация агента для этого состояния недоступна.")
        if not sandbox.enrollment_token_hash or not sandbox.enrollment_expires_at:
            raise ValueError("Токен регистрации не активен.")
        if datetime.now(timezone.utc) > sandbox.enrollment_expires_at:
            raise ValueError("Токен регистрации истёк. Создайте новую песочницу или запросите перевыпуск у администратора.")

        if _hash_token(enrollment_token.strip()) != sandbox.enrollment_token_hash:
            raise ValueError("Неверный токен регистрации.")

        agent_public_id = secrets.token_hex(16)
        agent_secret = secrets.token_urlsafe(32)
        full_agent_token = f"{agent_public_id}.{agent_secret}"

        sandbox.agent_public_id = agent_public_id
        sandbox.agent_token_hash = _hash_token(full_agent_token)
        sandbox.agent_instance_id = (agent_instance_id or "")[:128] or None
        sandbox.enrollment_token_hash = None
        sandbox.enrollment_expires_at = None
        sandbox.status = "ready"
        fqdn = f"{sandbox.desired_subdomain}.{sandbox.dns_parent_zone}"
        sandbox.public_base_url = f"https://{fqdn}"

        self._append_audit(
            sandbox_id=sandbox.id,
            admin_user_id=None,
            action="agent_enrolled",
            payload={"agent_instance_id": sandbox.agent_instance_id},
        )

        await self.db.commit()
        await self.db.refresh(sandbox)

        from app.services.platform_ops_notify import notify_platform_ops

        await notify_platform_ops(
            self.db,
            event_code="sandbox_ready",
            title="Песочница готова (агент подключён)",
            lines=[
                f"Sandbox ID: {sandbox.id}",
                f"URL: {sandbox.public_base_url or fqdn}",
                f"Agent: {sandbox.agent_instance_id or sandbox.agent_public_id or '—'}",
            ],
            admin_url="/admin/sandbox",
        )

        meta = {
            "public_api_base_url": (settings.public_api_base_url or "").rstrip("/")
            or f"http://localhost:8000{settings.api_v1_prefix}",
            "desired_public_base_url": sandbox.public_base_url or "",
            "tenant_id": sandbox.tenant_id,
            "project_id": sandbox.project_id or "",
            "agent_public_id": agent_public_id,
        }
        return full_agent_token, meta

    async def resolve_agent_from_bearer(self, bearer_token: str) -> MerchantSandbox:
        raw = bearer_token.strip()
        if "." not in raw:
            raise ValueError("Неверный формат токена агента.")
        pub, _, _rest = raw.partition(".")
        if len(pub) < 8:
            raise ValueError("Неверный формат токена агента.")
        sandbox = await self.db.scalar(
            select(MerchantSandbox).where(MerchantSandbox.agent_public_id == pub)
        )
        if sandbox is None or not sandbox.agent_token_hash:
            raise ValueError("Агент не найден.")
        if _hash_token(raw) != sandbox.agent_token_hash:
            raise ValueError("Неверный токен агента.")
        return sandbox

    async def record_agent_heartbeat(self, sandbox_id: str) -> None:
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)
        await self.db.execute(
            update(MerchantSandbox)
            .where(MerchantSandbox.id == sandbox_id)
            .values(updated_at=func.now())
        )
        await self.db.commit()

    async def provision_dns(
        self,
        *,
        sandbox_id: str,
        ipv4: str,
        proxied: bool = True,
        admin_user_id: str | None = None,
    ) -> MerchantSandbox:
        try:
            ipaddress.IPv4Address(ipv4.strip())
        except ipaddress.AddressValueError as exc:
            raise ValueError("Некорректный IPv4.") from exc

        billing = BillingPolicyService(self.db)
        api_token = await billing.get_decrypted_sandbox_cloudflare_token()
        if not api_token:
            raise ValueError("В настройках платформы не задан Cloudflare API token для песочницы.")

        sandbox = await self.db.get(MerchantSandbox, sandbox_id)
        if sandbox is None:
            raise ValueError("Песочница не найдена.")

        cf = CloudflareDnsService(api_token)
        zone_name = sandbox.dns_parent_zone.strip().lower().rstrip(".")
        zone_id = sandbox.cloudflare_zone_id or cf.get_zone_id_by_name(zone_name)
        if zone_id is None:
            raise ValueError(f"Зона «{zone_name}» не найдена в Cloudflare для этого токена.")

        sandbox.cloudflare_zone_id = zone_id
        fqdn = f"{sandbox.desired_subdomain}.{zone_name}"

        if sandbox.cloudflare_dns_record_id:
            try:
                cf.delete_dns_record(zone_id=zone_id, record_id=sandbox.cloudflare_dns_record_id)
            except CloudflareDnsError:
                logger.exception("Не удалось удалить старую DNS-запись, создаём новую.")

        try:
            rec = cf.create_a_record(
                zone_id=zone_id,
                fqdn=fqdn,
                ipv4=ipv4.strip(),
                proxied=proxied,
            )
        except CloudflareDnsError as exc:
            raise ValueError(str(exc)) from exc

        sandbox.cloudflare_dns_record_id = str(rec.get("id", ""))
        sandbox.origin_ipv4 = ipv4.strip()
        sandbox.public_base_url = f"https://{fqdn}"

        project = await self.db.get(Project, sandbox.project_id)
        if project is None:
            raise ValueError("Проект песочницы не найден.")

        self._append_audit(
            sandbox_id=sandbox.id,
            admin_user_id=admin_user_id,
            action="dns_provisioned",
            payload={"fqdn": fqdn, "ipv4": ipv4.strip(), "record_id": sandbox.cloudflare_dns_record_id},
        )

        await set_db_security_context(self.db, tenant_id=sandbox.tenant_id, is_superadmin=True)
        project_service = ProjectService(self.db)
        webhook_secret = secrets.token_urlsafe(28)
        webhook_url = f"{sandbox.public_base_url.rstrip('/')}/webhook"
        await project_service.update_webhook_config(
            sandbox.tenant_id,
            project.id,
            webhook_url,
            webhook_secret,
        )

        await self.db.refresh(sandbox)
        await apply_db_security_context(self.db)
        AccountingService.invalidate_cache()
        return sandbox

    async def destroy_sandbox(self, *, sandbox_id: str, admin_user_id: str) -> None:
        sandbox = await self.db.get(MerchantSandbox, sandbox_id)
        if sandbox is None:
            raise ValueError("Песочница не найдена.")

        billing = BillingPolicyService(self.db)
        api_token = await billing.get_decrypted_sandbox_cloudflare_token()

        if sandbox.cloudflare_dns_record_id and sandbox.cloudflare_zone_id and api_token:
            cf = CloudflareDnsService(api_token)
            try:
                cf.delete_dns_record(
                    zone_id=sandbox.cloudflare_zone_id,
                    record_id=sandbox.cloudflare_dns_record_id,
                )
            except CloudflareDnsError:
                logger.exception("DNS: не удалось удалить запись при уничтожении песочницы.")

        tenant_id = sandbox.tenant_id
        await self._wipe_tenant_completely(tenant_id)

        AccountingService.invalidate_cache()

    async def _wipe_tenant_completely(self, tenant_id: str) -> None:
        """Полное удаление данных тенанта-песочницы (включая инвойсы и транзакции)."""
        await set_db_security_context(self.db, tenant_id=None, is_superadmin=True)

        invoice_ids = list(
            (await self.db.scalars(select(Invoice.id).where(Invoice.tenant_id == tenant_id))).all()
        )
        await self.db.execute(delete(LedgerEntry).where(LedgerEntry.tenant_id == tenant_id))
        await self.db.execute(delete(Transaction).where(Transaction.tenant_id == tenant_id))
        if invoice_ids:
            await self.db.execute(delete(ProviderEvent).where(ProviderEvent.invoice_id.in_(invoice_ids)))
        await self.db.execute(delete(Invoice).where(Invoice.tenant_id == tenant_id))

        await self.db.execute(delete(PayoutRequest).where(PayoutRequest.tenant_id == tenant_id))
        await self.db.execute(delete(TenantBalance).where(TenantBalance.tenant_id == tenant_id))

        project_ids = list(
            (await self.db.scalars(select(Project.id).where(Project.tenant_id == tenant_id))).all()
        )
        if project_ids:
            await self.db.execute(delete(ApiKey).where(ApiKey.project_id.in_(project_ids)))
            await self.db.execute(delete(Project).where(Project.id.in_(project_ids)))

        user_ids = list((await self.db.scalars(select(User.id).where(User.tenant_id == tenant_id))).all())
        if user_ids:
            await self.db.execute(delete(UserSession).where(UserSession.user_id.in_(user_ids)))
            await self.db.execute(delete(InviteToken).where(InviteToken.user_id.in_(user_ids)))
            await self.db.execute(delete(User).where(User.id.in_(user_ids)))

        await self.db.execute(delete(StatisticsExclusion).where(StatisticsExclusion.tenant_id == tenant_id))
        await self.db.execute(delete(MerchantSandbox).where(MerchantSandbox.tenant_id == tenant_id))
        await self.db.execute(delete(TenantFeePolicy).where(TenantFeePolicy.tenant_id == tenant_id))
        await self.db.execute(delete(Tenant).where(Tenant.id == tenant_id))
        await self.db.commit()
        await apply_db_security_context(self.db)

    async def list_sandboxes(self, limit: int = 50) -> list[tuple[MerchantSandbox, Tenant]]:
        stmt = (
            select(MerchantSandbox, Tenant)
            .join(Tenant, Tenant.id == MerchantSandbox.tenant_id)
            .order_by(MerchantSandbox.created_at.desc())
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).all())

    async def get_sandbox(self, sandbox_id: str) -> MerchantSandbox | None:
        return await self.db.get(MerchantSandbox, sandbox_id)
