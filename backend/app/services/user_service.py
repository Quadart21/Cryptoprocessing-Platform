from __future__ import annotations

from datetime import datetime, timezone
from secrets import token_urlsafe

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rbac import (
    PLATFORM_ROLES,
    get_role_definition,
    is_platform_role,
    is_tenant_role,
    normalize_role,
)
from app.core.security import get_password_hash
from app.models.invite_token import InviteToken
from app.models.merchant_sandbox import MerchantSandbox
from app.models.payout_request import PayoutRequest
from app.models.sandbox_audit_log import SandboxAuditLog
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_session import UserSession


class UserService:
    ALLOWED_STATUSES = {"invited", "active", "suspended"}

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        return await self.db.scalar(select(User).where(User.email == email))

    async def get_by_id(self, user_id: str) -> User | None:
        return await self.db.get(User, user_id)

    async def list_users(
        self,
        tenant_id: str | None = None,
        scope: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[User, str | None]]:
        stmt = (
            select(User, Tenant.name)
            .outerjoin(Tenant, Tenant.id == User.tenant_id)
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if tenant_id:
            stmt = stmt.where(User.tenant_id == tenant_id)
        normalized_scope = (scope or "").strip().lower()
        if normalized_scope == "platform":
            stmt = stmt.where(User.role.in_(PLATFORM_ROLES))
        elif normalized_scope == "tenant":
            stmt = stmt.where(User.tenant_id.is_not(None))
        return list((await self.db.execute(stmt)).all())

    async def create_user(
        self,
        *,
        email: str,
        full_name: str,
        role: str,
        tenant_id: str | None,
        status: str,
        password: str | None,
    ) -> User:
        normalized_email = email.strip().lower()
        if await self.get_by_email(normalized_email):
            raise ValueError("Пользователь с таким email уже существует.")

        normalized_role = normalize_role(role)
        normalized_status = self._normalize_status(status)
        self._validate_role_tenant_scope(normalized_role, tenant_id)
        if tenant_id:
            await self._ensure_tenant_exists(tenant_id)

        now = datetime.now(timezone.utc)
        user = User(
            tenant_id=tenant_id,
            email=normalized_email,
            password_hash=get_password_hash(password or token_urlsafe(24)),
            full_name=full_name.strip(),
            role=normalized_role,
            status=normalized_status,
            invited_at=now if normalized_status == "invited" else None,
            activated_at=now if normalized_status == "active" else None,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_user(self, user_id: str, updates: dict) -> User:
        user = await self.get_by_id(user_id)
        if user is None:
            raise ValueError("Пользователь не найден.")

        role_in_payload = "role" in updates
        tenant_in_payload = "tenant_id" in updates

        next_role = normalize_role(str(updates["role"])) if role_in_payload else user.role
        next_tenant_id = updates["tenant_id"] if tenant_in_payload else user.tenant_id

        self._validate_role_tenant_scope(next_role, next_tenant_id)
        if next_tenant_id:
            await self._ensure_tenant_exists(next_tenant_id)

        if "full_name" in updates and updates["full_name"] is not None:
            user.full_name = str(updates["full_name"]).strip()
        if role_in_payload:
            user.role = next_role
        if tenant_in_payload:
            user.tenant_id = next_tenant_id
        if "status" in updates and updates["status"] is not None:
            user.status = self._normalize_status(str(updates["status"]))
            if user.status == "active" and user.activated_at is None:
                user.activated_at = datetime.now(timezone.utc)
            if user.status == "invited" and user.invited_at is None:
                user.invited_at = datetime.now(timezone.utc)
        if "password" in updates and updates["password"]:
            user.password_hash = get_password_hash(str(updates["password"]))
            user.failed_login_attempts = 0
            user.last_failed_login_at = None
            user.login_locked_until = None
        if updates.get("reset_two_factor"):
            user.totp_enabled = False
            user.totp_secret_encrypted = None
            user.totp_confirmed_at = None

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def delete_user(self, user_id: str, *, actor_id: str) -> None:
        user = await self.get_by_id(user_id)
        if user is None:
            raise ValueError("Пользователь не найден.")
        if user.id == actor_id:
            raise ValueError("Нельзя удалить собственную учётную запись.")

        if not is_platform_role(user.role):
            raise ValueError(
                "Удаление пользователей клиента выполняется из карточки клиента."
            )

        if user.role == "superadmin":
            superadmin_count = await self.db.scalar(
                select(func.count())
                .select_from(User)
                .where(User.role == "superadmin")
            )
            if superadmin_count is not None and superadmin_count <= 1:
                raise ValueError("Нельзя удалить последнего супер-админа.")

        await self.db.execute(
            update(PayoutRequest)
            .where(PayoutRequest.requested_by_user_id == user.id)
            .values(requested_by_user_id=None)
        )
        await self.db.execute(
            update(PayoutRequest)
            .where(PayoutRequest.reviewed_by_user_id == user.id)
            .values(reviewed_by_user_id=None)
        )
        await self.db.execute(
            update(MerchantSandbox)
            .where(MerchantSandbox.created_by_user_id == user.id)
            .values(created_by_user_id=None)
        )
        await self.db.execute(
            update(SandboxAuditLog)
            .where(SandboxAuditLog.admin_user_id == user.id)
            .values(admin_user_id=None)
        )
        await self.db.execute(delete(UserSession).where(UserSession.user_id == user.id))
        await self.db.execute(delete(InviteToken).where(InviteToken.user_id == user.id))
        await self.db.execute(delete(User).where(User.id == user.id))
        await self.db.commit()

    async def ensure_superadmin(self) -> User:
        normalized_email = settings.superadmin_email.strip().lower()
        existing = await self.get_by_email(normalized_email)
        if existing is not None:
            has_changes = False
            if existing.role != "superadmin":
                existing.role = "superadmin"
                has_changes = True
            if existing.status != "active":
                existing.status = "active"
                has_changes = True
            if existing.email != normalized_email:
                existing.email = normalized_email
                has_changes = True
            if existing.full_name != settings.superadmin_full_name:
                existing.full_name = settings.superadmin_full_name
                has_changes = True

            # Keep superadmin credentials in sync with .env for reliable first login after deploy.
            existing.password_hash = get_password_hash(settings.superadmin_password)
            existing.failed_login_attempts = 0
            existing.last_failed_login_at = None
            existing.login_locked_until = None
            has_changes = True

            if has_changes:
                self.db.add(existing)
                await self.db.commit()
                await self.db.refresh(existing)
            return existing

        user = User(
            tenant_id=None,
            email=normalized_email,
            password_hash=get_password_hash(settings.superadmin_password),
            full_name=settings.superadmin_full_name,
            role="superadmin",
            status="active",
            activated_at=datetime.now(timezone.utc),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    @classmethod
    def _normalize_status(cls, status: str) -> str:
        normalized = status.strip().lower()
        if normalized not in cls.ALLOWED_STATUSES:
            raise ValueError(
                f"Недопустимый статус '{status}'. Разрешены: {', '.join(sorted(cls.ALLOWED_STATUSES))}."
            )
        return normalized

    @staticmethod
    def _validate_role_tenant_scope(role: str, tenant_id: str | None) -> None:
        role_definition = get_role_definition(role)
        if role_definition is None:
            raise ValueError(f"Неизвестная роль '{role}'.")

        if is_platform_role(role) and tenant_id is not None:
            raise ValueError("Платформенная роль не может быть привязана к tenant.")
        if is_tenant_role(role) and not tenant_id:
            raise ValueError("Для роли клиента нужно указать tenant_id.")

    async def _ensure_tenant_exists(self, tenant_id: str) -> None:
        tenant = await self.db.get(Tenant, tenant_id)
        if tenant is None:
            raise ValueError("Указанный tenant не найден.")
