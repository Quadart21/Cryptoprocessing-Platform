from __future__ import annotations

import threading
import time

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.tenant import set_db_security_context
from app.models.api_key import ApiKey


class ApiKeyTenantCache:
    def __init__(self, *, ttl_seconds: int = 300) -> None:
        self._ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._entries: dict[str, tuple[str, float]] = {}

    async def resolve_tenant_id(self, public_key: str) -> str | None:
        normalized = public_key.strip()
        if not normalized:
            return None

        cached = self._get_cached(normalized)
        if cached is not None:
            return cached

        tenant_id = await self._load_tenant_id(normalized)
        if tenant_id is not None:
            self._set_cached(normalized, tenant_id)
        return tenant_id

    def _get_cached(self, public_key: str) -> str | None:
        now = time.time()
        with self._lock:
            entry = self._entries.get(public_key)
            if entry is None:
                return None
            tenant_id, expires_at = entry
            if expires_at <= now:
                self._entries.pop(public_key, None)
                return None
            return tenant_id

    def _set_cached(self, public_key: str, tenant_id: str) -> None:
        expires_at = time.time() + self._ttl_seconds
        with self._lock:
            self._entries[public_key] = (tenant_id, expires_at)
            if len(self._entries) > 5000:
                self._prune_locked()

    def _prune_locked(self) -> None:
        now = time.time()
        stale_keys = [key for key, (_, expires_at) in self._entries.items() if expires_at <= now]
        for key in stale_keys:
            self._entries.pop(key, None)

    @staticmethod
    async def _load_tenant_id(public_key: str) -> str | None:
        async with AsyncSessionLocal() as db:
            await set_db_security_context(db, tenant_id=None, is_superadmin=True)
            stmt = (
                select(ApiKey.tenant_id)
                .where(ApiKey.public_key == public_key, ApiKey.status == "active")
                .limit(1)
            )
            return await db.scalar(stmt)


_api_key_tenant_cache = ApiKeyTenantCache()


def get_api_key_tenant_cache() -> ApiKeyTenantCache:
    return _api_key_tenant_cache
