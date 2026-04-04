from __future__ import annotations

import json
import threading
import time
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any

import redis

from app.core.config import settings


class CacheService:
    PREFIX = "cp:cache"

    def __init__(self, redis_url: str, default_ttl_seconds: int):
        self._redis = self._build_redis_client(redis_url)
        self._default_ttl_seconds = max(default_ttl_seconds, 1)
        self._lock = threading.Lock()
        self._local: dict[str, tuple[str, float]] = {}

    def get_json(self, key: str) -> dict[str, Any] | list[Any] | None:
        normalized_key = self._full_key(key)
        if self._redis is not None:
            try:
                raw = self._redis.get(normalized_key)
                if raw is None:
                    return None
                return self._loads(raw.decode("utf-8"))
            except (redis.RedisError, UnicodeDecodeError, json.JSONDecodeError):
                self._redis = None
        return self._get_local(normalized_key)

    def set_json(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        normalized_key = self._full_key(key)
        ttl = max(ttl_seconds or self._default_ttl_seconds, 1)
        serialized = self._dumps(value)
        if self._redis is not None:
            try:
                self._redis.setex(normalized_key, ttl, serialized.encode("utf-8"))
                return
            except redis.RedisError:
                self._redis = None
        self._set_local(normalized_key, serialized, ttl)

    def delete(self, key: str) -> None:
        normalized_key = self._full_key(key)
        if self._redis is not None:
            try:
                self._redis.delete(normalized_key)
            except redis.RedisError:
                self._redis = None
        with self._lock:
            self._local.pop(normalized_key, None)

    def delete_by_prefix(self, prefix: str) -> None:
        normalized_prefix = self._full_key(prefix)
        if self._redis is not None:
            try:
                keys = list(self._redis.scan_iter(match=f"{normalized_prefix}*"))
                if keys:
                    self._redis.delete(*keys)
            except redis.RedisError:
                self._redis = None
        with self._lock:
            stale_keys = [key for key in self._local if key.startswith(normalized_prefix)]
            for key in stale_keys:
                self._local.pop(key, None)

    def _get_local(self, normalized_key: str) -> dict[str, Any] | list[Any] | None:
        now = time.time()
        with self._lock:
            item = self._local.get(normalized_key)
            if item is None:
                return None
            serialized, expires_at = item
            if expires_at <= now:
                self._local.pop(normalized_key, None)
                return None
        try:
            return self._loads(serialized)
        except json.JSONDecodeError:
            return None

    def _set_local(self, normalized_key: str, serialized: str, ttl_seconds: int) -> None:
        expires_at = time.time() + ttl_seconds
        with self._lock:
            self._local[normalized_key] = (serialized, expires_at)
            if len(self._local) > 2000:
                self._cleanup_local(time.time())

    def _cleanup_local(self, now: float) -> None:
        stale_keys = [
            key for key, (_, expires_at) in self._local.items() if expires_at <= now
        ]
        for key in stale_keys:
            self._local.pop(key, None)

    def _full_key(self, key: str) -> str:
        clean_key = (key or "").strip() or "default"
        return f"{self.PREFIX}:{clean_key}"

    @staticmethod
    def _build_redis_client(redis_url: str) -> redis.Redis | None:
        try:
            client = redis.Redis.from_url(redis_url, decode_responses=False)
            client.ping()
            return client
        except redis.RedisError:
            return None

    @staticmethod
    def _dumps(value: Any) -> str:
        return json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
            default=CacheService._json_default,
        )

    @staticmethod
    def _loads(value: str) -> dict[str, Any] | list[Any]:
        parsed = json.loads(value)
        if isinstance(parsed, (dict, list)):
            return parsed
        raise json.JSONDecodeError("Unsupported payload type.", value, 0)

    @staticmethod
    def _json_default(value: Any) -> str:
        if isinstance(value, Decimal):
            return format(value, "f")
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value)


@lru_cache
def get_cache_service() -> CacheService:
    return CacheService(
        settings.redis_url,
        settings.cache_default_ttl_seconds,
    )
