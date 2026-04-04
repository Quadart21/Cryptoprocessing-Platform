import ipaddress
import socket
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

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
    def __init__(self, db: Session):
        self.db = db

    def create_project(self, tenant_id: str, payload: ProjectCreateRequest) -> Project:
        normalized_domain = self._normalize_project_domain(payload.domain)
        existing_project = self.db.scalar(
            select(Project.id).where(Project.domain == normalized_domain)
        )
        if existing_project is not None:
            raise ValueError("Домен проекта уже используется. Укажите другой домен.")

        project = Project(
            tenant_id=tenant_id,
            name=payload.name,
            domain=normalized_domain,
            description=payload.description,
            status="pending_review",
        )
        self.db.add(project)
        self.db.flush()
        return project

    def create_api_key(self, tenant_id: str, project_id: str) -> tuple[ApiKey, str]:
        public_key = self._ensure_unique_public_key()
        secret_key = KeyService.generate_secret_key()
        api_key = ApiKey(
            tenant_id=tenant_id,
            project_id=project_id,
            public_key=public_key,
            secret_hash=KeyService.hash_secret(secret_key),
            status="active",
        )
        self.db.add(api_key)
        self.db.flush()
        return api_key, secret_key

    def list_projects_by_tenant(self, tenant_id: str) -> list[Project]:
        stmt = (
            select(Project)
            .where(Project.tenant_id == tenant_id)
            .order_by(Project.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def list_api_keys_by_tenant(self, tenant_id: str) -> list[ApiKey]:
        stmt = (
            select(ApiKey)
            .where(ApiKey.tenant_id == tenant_id)
            .order_by(ApiKey.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_project(self, project_id: str) -> Project | None:
        return self.db.get(Project, project_id)

    def update_webhook_config(
        self,
        tenant_id: str,
        project_id: str,
        webhook_url: str,
        webhook_secret: str | None = None,
    ) -> Project:
        project = self.get_project(project_id)
        if project is None or project.tenant_id != tenant_id:
            raise ValueError("Project not found.")

        project.webhook_url = self._normalize_webhook_url(webhook_url)

        secret = (webhook_secret or "").strip()
        if secret:
            project.webhook_secret_hash = KeyService.hash_secret(secret)
            project.webhook_secret_encrypted = encrypt_value(secret)

        self.db.add(project)
        self.db.commit()
        apply_db_security_context(self.db)
        self.db.refresh(project)
        return project

    def get_api_key(self, api_key_id: str) -> ApiKey | None:
        return self.db.get(ApiKey, api_key_id)

    def revoke_api_key(self, api_key_id: str) -> ApiKey:
        api_key = self.get_api_key(api_key_id)
        if api_key is None:
            raise ValueError("API key not found.")
        api_key.status = "revoked"
        self.db.add(api_key)
        self.db.commit()
        apply_db_security_context(self.db)
        self.db.refresh(api_key)
        return api_key

    def regenerate_api_key(self, api_key_id: str) -> tuple[ApiKey, str]:
        api_key = self.get_api_key(api_key_id)
        if api_key is None:
            raise ValueError("API key not found.")

        api_key.public_key = self._ensure_unique_public_key()
        secret_key = KeyService.generate_secret_key()
        api_key.secret_hash = KeyService.hash_secret(secret_key)
        api_key.status = "active"
        self.db.add(api_key)
        self.db.commit()
        apply_db_security_context(self.db)
        self.db.refresh(api_key)
        return api_key, secret_key

    def _ensure_unique_public_key(self) -> str:
        public_key = KeyService.generate_public_key()
        while (
            self.db.scalar(select(ApiKey).where(ApiKey.public_key == public_key))
            is not None
        ):
            public_key = KeyService.generate_public_key()
        return public_key

    @staticmethod
    def _normalize_project_domain(domain: str) -> str:
        normalized = domain.strip().lower()
        if not normalized:
            raise ValueError("Укажите домен проекта.")
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
