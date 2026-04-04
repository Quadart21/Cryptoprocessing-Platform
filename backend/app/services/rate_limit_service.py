from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass
from functools import lru_cache

import redis

from app.core.config import settings


@dataclass
class RateLimitHit:
    current: int
    limit: int
    retry_after: int


class RateLimitExceededError(Exception):
    def __init__(self, *, scope: str, key: str, limit: int, retry_after: int):
        self.scope = scope
        self.key = key
        self.limit = limit
        self.retry_after = max(retry_after, 1)
        super().__init__("Rate limit exceeded.")


class RateLimitService:
    PREFIX = "cp:rate_limit"

    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._redis = self._build_redis_client(redis_url)
        self._local_lock = threading.Lock()
        self._local_counters: dict[str, tuple[int, float]] = {}

    def enforce(self, *, scope: str, key: str, limit: int, window_seconds: int) -> RateLimitHit:
        if limit <= 0:
            return RateLimitHit(current=0, limit=0, retry_after=window_seconds)

        normalized_key = self._normalize_key(key)
        now = int(time.time())
        bucket = now // window_seconds
        redis_key = f"{self.PREFIX}:{scope}:{normalized_key}:{bucket}"
        ttl_seconds = max(window_seconds + 1, 2)
        retry_after = max(window_seconds - (now % window_seconds), 1)

        current = self._hit(redis_key, ttl_seconds)
        if current > limit:
            raise RateLimitExceededError(
                scope=scope,
                key=normalized_key,
                limit=limit,
                retry_after=retry_after,
            )
        return RateLimitHit(current=current, limit=limit, retry_after=retry_after)

    def _hit(self, key: str, ttl_seconds: int) -> int:
        if self._redis is not None:
            try:
                pipeline = self._redis.pipeline()
                pipeline.incr(key, 1)
                pipeline.expire(key, ttl_seconds)
                current, _ = pipeline.execute()
                return int(current)
            except redis.RedisError:
                self._redis = None
        return self._hit_local(key, ttl_seconds)

    def _hit_local(self, key: str, ttl_seconds: int) -> int:
        now = time.time()
        with self._local_lock:
            current, expires_at = self._local_counters.get(key, (0, now + ttl_seconds))
            if expires_at <= now:
                current = 0
                expires_at = now + ttl_seconds
            current += 1
            self._local_counters[key] = (current, expires_at)
            self._cleanup_local(now)
            return current

    def _cleanup_local(self, now: float) -> None:
        if len(self._local_counters) < 1000:
            return
        stale_keys = [
            key
            for key, (_, expires_at) in self._local_counters.items()
            if expires_at <= now
        ]
        for key in stale_keys:
            self._local_counters.pop(key, None)

    @staticmethod
    def _normalize_key(value: str) -> str:
        raw = (value or "").strip()
        if not raw:
            return "unknown"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

    @staticmethod
    def _build_redis_client(redis_url: str) -> redis.Redis | None:
        try:
            client = redis.Redis.from_url(redis_url, decode_responses=False)
            client.ping()
            return client
        except redis.RedisError:
            return None


@lru_cache
def get_rate_limit_service() -> RateLimitService:
    return RateLimitService(settings.redis_url)
