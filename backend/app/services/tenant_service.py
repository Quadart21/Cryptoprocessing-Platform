from datetime import datetime, timezone
import re
import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.tenant import apply_db_security_context, set_db_security_context
from app.models.project import Project
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.project import ProjectCreateRequest
from app.schemas.tenant import TenantCreateRequest
from app.services.project_service import ProjectService


class TenantService:
    def __init__(self, db: Session):
        self.db = db

    def create_tenant_with_owner(self, payload: TenantCreateRequest) -> tuple[Tenant, User, str, str, str]:
        slug_base = self._slugify(payload.company_name) or "tenant"
        slug = self._build_unique_slug(slug_base)

        tenant = Tenant(
            name=payload.company_name,
            slug=slug,
            status="pending_review",
            timezone=payload.timezone,
            base_currency=payload.base_currency.upper(),
            plan=payload.plan,
        )
        self.db.add(tenant)
        self.db.flush()
        set_db_security_context(self.db, tenant_id=tenant.id, is_superadmin=True)

        owner = User(
            tenant_id=tenant.id,
            email=payload.owner_email,
            password_hash=get_password_hash("temporary-password-change-me"),
            full_name=payload.owner_full_name,
            role="tenant_owner",
            status="invited",
            invited_at=datetime.now(timezone.utc),
        )
        self.db.add(owner)
        project_service = ProjectService(self.db)
        project = project_service.create_project(
            tenant.id,
            ProjectCreateRequest(
                name=payload.company_name,
                domain=payload.domain,
                description=payload.project_description,
            ),
        )
        api_key, secret_key = project_service.create_api_key(tenant.id, project.id)
        self.db.commit()
        self.db.refresh(tenant)
        self.db.refresh(owner)
        return tenant, owner, project.id, api_key.public_key, secret_key

    def list_tenants(self, limit: int = 50, offset: int = 0) -> list[tuple[Tenant, User]]:
        stmt = (
            select(Tenant, User)
            .join(User, User.tenant_id == Tenant.id)
            .where(User.role == "tenant_owner")
            .order_by(Tenant.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.execute(stmt).all())

    def register_self_service(
        self,
        company_name: str,
        owner_full_name: str,
        owner_email: str,
        password: str,
        domain: str,
        project_description: str | None,
        timezone: str,
        base_currency: str,
        plan: str,
    ) -> tuple[Tenant, User, Project]:
        slug_base = self._slugify(company_name) or "tenant"
        slug = self._build_unique_slug(slug_base)

        tenant = Tenant(
            name=company_name,
            slug=slug,
            status="pending_review",
            timezone=timezone,
            base_currency=base_currency.upper(),
            plan=plan,
        )
        self.db.add(tenant)
        self.db.flush()
        set_db_security_context(self.db, tenant_id=tenant.id, is_superadmin=False)

        owner = User(
            tenant_id=tenant.id,
            email=owner_email,
            password_hash=get_password_hash(password),
            full_name=owner_full_name,
            role="tenant_owner",
            status="invited",
            invited_at=datetime.now(timezone.utc),
        )
        self.db.add(owner)

        project_service = ProjectService(self.db)
        project = project_service.create_project(
            tenant.id,
            ProjectCreateRequest(
                name=company_name,
                domain=domain,
                description=project_description,
            ),
        )
        self.db.commit()
        apply_db_security_context(self.db)
        self.db.refresh(tenant)
        self.db.refresh(owner)
        self.db.refresh(project)
        return tenant, owner, project

    def approve_tenant(
        self,
        tenant_id: str,
        review_comment: str | None = None,
    ) -> tuple[Tenant, Project, User, str, str, str]:
        tenant = self.db.get(Tenant, tenant_id)
        if tenant is None:
            raise ValueError("Tenant не найден.")

        project = self.db.scalar(
            select(Project).where(Project.tenant_id == tenant_id).order_by(Project.created_at.asc())
        )
        if project is None:
            raise ValueError("Проект tenant не найден.")

        owner = self.db.scalar(
            select(User)
            .where(
                User.tenant_id == tenant_id,
                User.role == "tenant_owner",
            )
            .order_by(User.created_at.asc())
        )
        if owner is None:
            raise ValueError("Владелец tenant не найден.")

        tenant.status = "approved"
        tenant.review_comment = review_comment
        project.status = "active"

        generated_password = self._generate_secure_password()
        owner.password_hash = get_password_hash(generated_password)
        owner.status = "active"
        if owner.activated_at is None:
            owner.activated_at = datetime.now(timezone.utc)
        owner.failed_login_attempts = 0
        owner.last_failed_login_at = None
        owner.login_locked_until = None

        project_service = ProjectService(self.db)
        api_key, secret_key = project_service.create_api_key(tenant.id, project.id)
        self.db.add_all([tenant, project, owner])
        self.db.commit()
        apply_db_security_context(self.db)
        self.db.refresh(tenant)
        self.db.refresh(project)
        self.db.refresh(owner)
        return tenant, project, owner, generated_password, api_key.public_key, secret_key

    def reject_tenant(self, tenant_id: str, review_comment: str | None = None) -> Tenant:
        tenant = self.db.get(Tenant, tenant_id)
        if tenant is None:
            raise ValueError("Tenant не найден.")

        tenant.status = "rejected"
        tenant.review_comment = review_comment
        project = self.db.scalar(
            select(Project).where(Project.tenant_id == tenant_id).order_by(Project.created_at.asc())
        )
        if project is not None:
            project.status = "rejected"
            self.db.add(project)
        
        project_service = ProjectService(self.db)
        revoked_count = project_service.revoke_all_tenant_api_keys(tenant_id)
        
        self.db.add(tenant)
        self.db.commit()
        self.db.refresh(tenant)
        return tenant

    def _build_unique_slug(self, slug_base: str) -> str:
        slug = slug_base
        counter = 1
        while self.db.scalar(select(Tenant).where(Tenant.slug == slug)) is not None:
            counter += 1
            slug = f"{slug_base}-{counter}"
        return slug

    @staticmethod
    def _slugify(value: str) -> str:
        normalized = value.strip().lower()
        normalized = re.sub(r"[^a-z0-9а-я]+", "-", normalized)
        normalized = re.sub(r"-{2,}", "-", normalized)
        return normalized.strip("-")

    @staticmethod
    def _generate_secure_password(length: int = 14) -> str:
        if length < 12:
            length = 12
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*()_+-="
        return "".join(secrets.choice(alphabet) for _ in range(length))
