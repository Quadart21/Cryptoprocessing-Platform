from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.tenant import set_db_security_context
from app.models.api_key import ApiKey


@dataclass(frozen=True)
class ApiKeyContext:
    tenant_id: str
    project_id: str


class ApiKeyContextCache:
    def __init__(self, *, ttl_seconds: int = 300) -> None:
        self._ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._entries: dict[str, tuple[ApiKeyContext, float]] = {}

    async def resolve(self, public_key: str) -> ApiKeyContext | None:
        normalized = public_key.strip()
        if not normalized:
            return None

        cached = self._get_cached(normalized)
        if cached is not None:
            return cached

        loaded = await self._load(normalized)
        if loaded is not None:
            self._set_cached(normalized, loaded)
        return loaded

    def _get_cached(self, public_key: str) -> ApiKeyContext | None:
        now = time.time()
        with self._lock:
            entry = self._entries.get(public_key)
            if entry is None:
                return None
            context, expires_at = entry
            if expires_at <= now:
                self._entries.pop(public_key, None)
                return None
            return context

    def _set_cached(self, public_key: str, context: ApiKeyContext) -> None:
        expires_at = time.time() + self._ttl_seconds
        with self._lock:
            self._entries[public_key] = (context, expires_at)
            if len(self._entries) > 5000:
                self._prune_locked()

    def _prune_locked(self) -> None:
        now = time.time()
        stale_keys = [key for key, (_, expires_at) in self._entries.items() if expires_at <= now]
        for key in stale_keys:
            self._entries.pop(key, None)

    @staticmethod
    async def _load(public_key: str) -> ApiKeyContext | None:
        async with AsyncSessionLocal() as db:
            await set_db_security_context(db, tenant_id=None, is_superadmin=True)
            row = (
                await db.execute(
                    select(ApiKey.tenant_id, ApiKey.project_id)
                    .where(ApiKey.public_key == public_key, ApiKey.status == "active")
                    .limit(1)
                )
            ).first()
            if row is None:
                return None
            tenant_id, project_id = row
            return ApiKeyContext(tenant_id=str(tenant_id), project_id=str(project_id))


_api_key_context_cache = ApiKeyContextCache()


def get_api_key_context_cache() -> ApiKeyContextCache:
    return _api_key_context_cache
