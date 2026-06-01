from __future__ import annotations

import hashlib
import threading
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache

import redis

from app.core.config import settings


@dataclass(frozen=True)
class ConnectionLease:
    key: str
    token: str


class ConnectionLimitService:
    PREFIX = "cp:conn"

    def __init__(self, redis_url: str):
        self._redis = self._build_redis_client(redis_url)
        self._local_lock = threading.Lock()
        self._local_slots: dict[str, dict[str, float]] = {}

    def acquire(self, *, client_key: str) -> ConnectionLease | None:
        limit = settings.max_concurrent_connections_per_ip
        if limit <= 0:
            return ConnectionLease(key="disabled", token="")

        normalized_key = self._normalize_key(client_key)
        token = uuid.uuid4().hex
        ttl_seconds = max(settings.max_concurrent_connection_ttl_seconds, 30)
        now = time.time()

        if self._redis is not None:
            try:
                acquired = self._acquire_redis(
                    redis_key=f"{self.PREFIX}:{normalized_key}",
                    token=token,
                    limit=limit,
                    ttl_seconds=ttl_seconds,
                    now=now,
                )
                if acquired:
                    return ConnectionLease(key=normalized_key, token=token)
                return None
            except redis.RedisError:
                self._redis = None

        return self._acquire_local(
            normalized_key=normalized_key,
            token=token,
            limit=limit,
            ttl_seconds=ttl_seconds,
            now=now,
        )

    def release(self, lease: ConnectionLease | None) -> None:
        if lease is None or not lease.token or lease.key == "disabled":
            return

        if self._redis is not None:
            try:
                self._redis.zrem(f"{self.PREFIX}:{lease.key}", lease.token)
                return
            except redis.RedisError:
                self._redis = None

        with self._local_lock:
            slots = self._local_slots.get(lease.key)
            if not slots:
                return
            slots.pop(lease.token, None)
            if not slots:
                self._local_slots.pop(lease.key, None)

    def _acquire_redis(
        self,
        *,
        redis_key: str,
        token: str,
        limit: int,
        ttl_seconds: int,
        now: float,
    ) -> bool:
        stale_before = now - ttl_seconds
        pipeline = self._redis.pipeline()
        pipeline.zremrangebyscore(redis_key, 0, stale_before)
        pipeline.zcard(redis_key)
        _, active = pipeline.execute()
        if int(active) >= limit:
            return False
        pipeline = self._redis.pipeline()
        pipeline.zadd(redis_key, {token: now})
        pipeline.expire(redis_key, ttl_seconds + 5)
        pipeline.execute()
        return True

    def _acquire_local(
        self,
        *,
        normalized_key: str,
        token: str,
        limit: int,
        ttl_seconds: int,
        now: float,
    ) -> ConnectionLease | None:
        with self._local_lock:
            slots = self._local_slots.setdefault(normalized_key, {})
            stale_before = now - ttl_seconds
            stale_tokens = [item for item, seen_at in slots.items() if seen_at < stale_before]
            for stale_token in stale_tokens:
                slots.pop(stale_token, None)
            if len(slots) >= limit:
                return None
            slots[token] = now
            return ConnectionLease(key=normalized_key, token=token)

    @staticmethod
    def _normalize_key(value: str) -> str:
        raw = (value or "").strip()
        if not raw:
            return "unknown"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

    @staticmethod
    def _build_redis_client(redis_url: str) -> redis.Redis | None:
        try:
            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            return client
        except redis.RedisError:
            return None


@lru_cache
def get_connection_limit_service() -> ConnectionLimitService:
    return ConnectionLimitService(settings.redis_url)
