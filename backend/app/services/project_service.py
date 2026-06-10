import ipaddress
import socket
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from types import SimpleNamespace

from app.core.config import settings
from app.core.security import encrypt_value
from app.db.tenant import apply_db_security_context
from app.models.api_key import ApiKey
from app.models.project import Project
from app.schemas.project import ProjectCreateRequest
from app.services.key_service import KeyService

BLOCKED_WEBHOOK_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "169.254.169.254",
    "100.100.100.200",
    "169.254.170.2",
}
BLOCKED_WEBHOOK_SUFFIXES = (
    ".localhost",
    ".local",
    ".internal",
)


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_project(self, tenant_id: str, payload: ProjectCreateRequest) -> Project:
        normalized_domain = self._normalize_project_domain(payload.domain)
        existing_project = await self.db.scalar(
            select(Project.id).where(Project.domain == normalized_domain)
        )
        if existing_project is not None:
            raise ValueError("Project domain is already in use. Choose another domain.")

        project = Project(
            tenant_id=tenant_id,
            name=payload.name,
            domain=normalized_domain,
            description=payload.description,
            checkout_delivery="payment_page",
            status="pending_review",
        )
        self.db.add(project)
        await self.db.flush()
        return project

    async def create_api_key(self, tenant_id: str, project_id: str) -> tuple[ApiKey, str]:
        public_key = await self._ensure_unique_public_key()
        secret_key = KeyService.generate_secret_key()
        api_key = ApiKey(
            tenant_id=tenant_id,
            project_id=project_id,
            public_key=public_key,
            secret_hash=KeyService.hash_secret(secret_key),
            status="active",
        )
        self.db.add(api_key)
        await self.db.flush()
        return api_key, secret_key

    async def list_projects_by_tenant(self, tenant_id: str) -> list[Project]:
        stmt = (
            select(Project)
            .where(Project.tenant_id == tenant_id)
            .order_by(Project.created_at.desc())
        )
        return list((await self.db.scalars(stmt)).all())

    async def list_api_keys_by_tenant(self, tenant_id: str) -> list[ApiKey]:
        stmt = (
            select(ApiKey)
            .where(ApiKey.tenant_id == tenant_id)
            .order_by(ApiKey.created_at.desc())
        )
        return list((await self.db.scalars(stmt)).all())

    async def get_project(self, project_id: str) -> Project | None:
        return await self.db.get(Project, project_id)

    async def update_webhook_config(
        self,
        tenant_id: str,
        project_id: str,
        webhook_url: str | None = None,
        webhook_secret: str | None = None,
        return_url_success: str | None = None,
        return_url_failed: str | None = None,
    ) -> Project:
        project = await self.get_project(project_id)
        if project is None or project.tenant_id != tenant_id:
            raise ValueError("Project not found.")

        if webhook_url is not None:
            trimmed = webhook_url.strip()
            if trimmed:
                project.webhook_url = self._normalize_webhook_url(trimmed)

        if return_url_success is not None:
            project.return_url_success = self._normalize_return_url(return_url_success)

        if return_url_failed is not None:
            project.return_url_failed = self._normalize_return_url(return_url_failed)

        secret = (webhook_secret or "").strip()
        if secret:
            project.webhook_secret_hash = KeyService.hash_secret(secret)
            project.webhook_secret_encrypted = encrypt_value(secret)

        has_return_update = return_url_success is not None or return_url_failed is not None
        if (
            webhook_url is None
            and not secret
            and not has_return_update
        ):
            raise ValueError(
                "Provide webhook URL, store return URLs, or secret.",
            )

        self.db.add(project)
        await self.db.commit()
        await apply_db_security_context(self.db)
        return project

    async def get_api_key(self, api_key_id: str) -> ApiKey | None:
        return await self.db.get(ApiKey, api_key_id)

    async def revoke_api_key(self, api_key_id: str) -> ApiKey:
        api_key = await self.get_api_key(api_key_id)
        if api_key is None:
            raise ValueError("API key not found.")

        snapshot = SimpleNamespace(
            id=api_key.id,
            tenant_id=api_key.tenant_id,
            project_id=api_key.project_id,
            public_key=api_key.public_key,
            status="revoked",
        )

        api_key.status = "revoked"
        self.db.add(api_key)
        await self.db.commit()
        await apply_db_security_context(self.db)
        return snapshot


    async def revoke_all_tenant_api_keys(self, tenant_id: str) -> int:
        stmt = (
            select(ApiKey)
            .where(ApiKey.tenant_id == tenant_id, ApiKey.status == "active")
        )
        api_keys = list((await self.db.scalars(stmt)).all())
        count = len(api_keys)
        for api_key in api_keys:
            api_key.status = "revoked"
            self.db.add(api_key)
        if api_keys:
            await self.db.commit()
            await apply_db_security_context(self.db)
        return count

    async def regenerate_api_key(self, api_key_id: str) -> tuple[ApiKey, str]:
        api_key = await self.get_api_key(api_key_id)
        if api_key is None:
            raise ValueError("API key not found.")

        new_public_key = await self._ensure_unique_public_key()
        secret_key = KeyService.generate_secret_key()

        snapshot = SimpleNamespace(
            id=api_key.id,
            tenant_id=api_key.tenant_id,
            project_id=api_key.project_id,
            public_key=new_public_key,
            status="active",
        )

        api_key.public_key = new_public_key
        api_key.secret_hash = KeyService.hash_secret(secret_key)
        api_key.status = "active"
        self.db.add(api_key)
        await self.db.commit()
        await apply_db_security_context(self.db)
        return snapshot, secret_key


    async def _ensure_unique_public_key(self) -> str:
        public_key = KeyService.generate_public_key()
        while (
            await self.db.scalar(select(ApiKey).where(ApiKey.public_key == public_key))
            is not None
        ):
            public_key = KeyService.generate_public_key()
        return public_key

    @staticmethod
    def _normalize_project_domain(domain: str) -> str:
        normalized = domain.strip().lower()
        if not normalized:
            raise ValueError("Project domain is required.")
        return normalized

    @staticmethod
    def has_webhook_secret(project: Project) -> bool:
        return bool(project.webhook_secret_hash and project.webhook_secret_encrypted)

    @staticmethod
    def _normalize_webhook_url(value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Webhook URL is required.")

        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Webhook URL must start with http:// or https:// and include a host.")

        if settings.is_production and parsed.scheme != "https":
            raise ValueError("Webhook URL must use HTTPS in production.")
        if not settings.is_production and not settings.webhook_allow_http_in_local and parsed.scheme != "https":
            raise ValueError("Webhook URL must use HTTPS.")

        if parsed.username or parsed.password:
            raise ValueError("Webhook URL with embedded credentials is not allowed.")

        hostname = (parsed.hostname or "").strip().lower()
        if not hostname:
            raise ValueError("Webhook URL must include a hostname.")
        if hostname in BLOCKED_WEBHOOK_HOSTNAMES:
            raise ValueError("Webhook hostname is blocked.")
        if any(hostname.endswith(suffix) for suffix in BLOCKED_WEBHOOK_SUFFIXES):
            raise ValueError("Webhook hostname zone is blocked.")

        ip_candidates = _resolve_public_ips(hostname)
        if not ip_candidates:
            raise ValueError("Webhook hostname could not be resolved.")
        for ip_value in ip_candidates:
            if _is_blocked_ip(ip_value):
                raise ValueError("Webhook target points to private/local/metadata network.")

        return normalized

    @staticmethod
    def _normalize_return_url(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Return URL must start with http:// or https:// and include a host.")
        if settings.is_production and parsed.scheme != "https":
            raise ValueError("Return URL must use HTTPS in production.")
        if (
            not settings.is_production
            and not settings.webhook_allow_http_in_local
            and parsed.scheme != "https"
        ):
            raise ValueError("Return URL must use HTTPS.")
        return normalized


def _resolve_public_ips(
    hostname: str,
) -> set[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    addresses: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()
    try:
        direct_ip = ipaddress.ip_address(hostname)
        addresses.add(direct_ip)
        return addresses
    except ValueError:
        pass

    try:
        resolved = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return addresses

    for item in resolved:
        sockaddr = item[4]
        if not sockaddr:
            continue
        ip_raw = str(sockaddr[0]).strip()
        try:
            addresses.add(ipaddress.ip_address(ip_raw))
        except ValueError:
            continue
    return addresses


def _is_blocked_ip(value: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if value.is_loopback or value.is_unspecified or value.is_multicast:
        return True
    if value.is_link_local or value.is_private or value.is_reserved:
        return True
    # Cloud metadata and special-use ranges.
    if isinstance(value, ipaddress.IPv4Address):
        if value in ipaddress.ip_network("100.64.0.0/10"):
            return True
        if value in ipaddress.ip_network("198.18.0.0/15"):
            return True
        if value in ipaddress.ip_network("169.254.0.0/16"):
            return True
    return False
