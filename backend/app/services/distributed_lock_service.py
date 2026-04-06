from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache

import redis

from app.core.config import settings


class LockAcquisitionError(Exception):
    pass


@dataclass
class DistributedLock:
    key: str
    lock_id: str
    redis_client: redis.Redis


class DistributedLockService:
    PREFIX = "cp:lock"
    DEFAULT_TIMEOUT_SECONDS = 10
    DEFAULT_RETRY_INTERVAL = 0.05
    DEFAULT_RETRY_COUNT = 100

    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._redis: redis.Redis | None = None
        self._connect()

    def _connect(self) -> None:
        try:
            self._redis = redis.Redis.from_url(self._redis_url, decode_responses=True)
            self._redis.ping()
        except redis.RedisError:
            self._redis = None

    @contextmanager
    def acquire(
        self,
        key: str,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
        retry_interval: float = DEFAULT_RETRY_INTERVAL,
        retry_count: int = DEFAULT_RETRY_COUNT,
    ):
        if self._redis is None:
            yield None
            return

        lock_id = str(uuid.uuid4())
        redis_key = f"{self.PREFIX}:{key}"

        for attempt in range(retry_count):
            acquired = self._redis.set(
                redis_key,
                lock_id,
                nx=True,
                ex=timeout_seconds,
            )
            if acquired:
                try:
                    yield DistributedLock(key=key, lock_id=lock_id, redis_client=self._redis)
                    return
                finally:
                    self._release_lock(redis_key, lock_id)
            time.sleep(retry_interval)

        raise LockAcquisitionError(f"Failed to acquire lock for key: {key}")

    def _release_lock(self, redis_key: str, lock_id: str) -> None:
        if self._redis is None:
            return
        try:
            current_lock_id = self._redis.get(redis_key)
            if current_lock_id == lock_id:
                self._redis.delete(redis_key)
        except redis.RedisError:
            pass


@lru_cache
def get_distributed_lock_service() -> DistributedLockService:
    return DistributedLockService(settings.redis_url)
