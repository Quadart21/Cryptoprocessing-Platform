from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

import redis

from app.core.config import settings
from app.services.api_usage_context import get_provider_usage_context

UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
    re.IGNORECASE,
)

CATEGORY_LABELS = {
    "merchant_api": "Входящие запросы к Merchant API",
    "public_pay": "Платёжная страница (/pay)",
    "provider_inbound": "Webhook от Crypto-Cash",
    "provider_outbound": "Исходящие запросы к Crypto-Cash",
    "merchant_webhook_out": "Webhook к мерчанту",
    "rate_limit_blocked": "Отклонено rate limit (429)",
}

ROUTE_LABELS = {
    "POST /client/invoices": "Создание инвойса",
    "GET /client/invoices": "Список инвойсов",
    "GET /client/invoices/{id}": "Получение инвойса",
    "POST /client/invoices/{id}/sync": "Синхронизация инвойса",
    "GET /client/balance": "Баланс",
    "GET /client/rates": "Курсы",
    "GET /client/transactions": "Транзакции",
    "GET /client/transactions/{id}": "Транзакция",
    "GET /client/accounting/summary": "Accounting summary",
    "POST /client/webhooks": "Настройка webhook",
    "GET /client/webhooks": "Список webhook",
    "POST /client/webhooks/test": "Тест webhook",
    "POST /client/payouts": "Создание payout",
    "GET /public/pay/{token}": "Открытие pay-страницы",
    "GET /public/pay/{token}?sync=1": "Sync pay-страницы (провайдер)",
    "POST /public/pay/{token}/refresh": "Refresh pay-страницы (legacy)",
    "POST /internal/webhook/crypto-cash": "Webhook Crypto-Cash",
    "POST /merchant/api/v1/balance/actions/sale/": "Crypto-Cash: sale",
    "POST /merchant/api/v1/balance/payments/retrieve/": "Crypto-Cash: retrieve",
    "POST /merchant/api/v1/crypto-currencies/list-in/": "Crypto-Cash: currencies (in)",
    "POST /merchant/api/v1/crypto-currencies/list/": "Crypto-Cash: currencies",
    "POST merchant_webhook": "Доставка webhook мерчанту",
}


@dataclass(frozen=True)
class ApiUsageRouteStat:
    route_key: str
    label: str
    total: int
    errors: int


@dataclass(frozen=True)
class ApiUsageCategoryStat:
    category: str
    label: str
    total: int
    errors: int
    routes: list[ApiUsageRouteStat]


@dataclass(frozen=True)
class ApiUsageSummary:
    scope_type: str
    scope_id: str
    period_days: int
    period_start: date
    period_end: date
    total_requests: int
    total_errors: int
    categories: list[ApiUsageCategoryStat]


class ApiUsageService:
    PREFIX = "cp:usage"
    RETENTION_DAYS = 45

    def __init__(self, redis_url: str):
        self._redis = self._build_redis_client(redis_url)
        self._local_lock = threading.Lock()
        self._local_hashes: dict[str, dict[str, int]] = {}

    def record(
        self,
        *,
        category: str,
        route_key: str,
        tenant_id: str | None = None,
        project_id: str | None = None,
        error: bool = False,
    ) -> None:
        normalized_route = normalize_route_key(route_key)
        usage_date = _today_utc()
        scopes = _resolve_scopes(tenant_id=tenant_id, project_id=project_id)

        for scope_type, scope_id in scopes:
            redis_key = self._hash_key(usage_date, category, scope_type, scope_id)
            field = normalized_route if not error else f"{normalized_route}:err"
            self._hincr(redis_key, field, 1)

    def record_provider_outbound(self, *, path: str, error: bool = False) -> None:
        context = get_provider_usage_context()
        self.record(
            category="provider_outbound",
            route_key=normalize_provider_path(path),
            tenant_id=context.tenant_id if context else None,
            project_id=context.project_id if context else None,
            error=error,
        )

    def record_rate_limit_hit(
        self,
        *,
        scope: str,
        tenant_id: str | None = None,
        project_id: str | None = None,
    ) -> None:
        self.record(
            category="rate_limit_blocked",
            route_key=scope,
            tenant_id=tenant_id,
            project_id=project_id,
            error=True,
        )

    def get_platform_usage(self, *, days: int = 30) -> ApiUsageSummary:
        return self._get_usage(scope_type="platform", scope_id="global", days=days)

    def get_project_usage(self, project_id: str, *, days: int = 30) -> ApiUsageSummary:
        return self._get_usage(scope_type="project", scope_id=project_id, days=days)

    def get_tenant_usage(self, tenant_id: str, *, days: int = 30) -> ApiUsageSummary:
        return self._get_usage(scope_type="tenant", scope_id=tenant_id, days=days)

    def _get_usage(self, *, scope_type: str, scope_id: str, days: int) -> ApiUsageSummary:
        bounded_days = max(1, min(days, self.RETENTION_DAYS))
        end = _today_utc()
        start = end - timedelta(days=bounded_days - 1)
        merged: dict[str, dict[str, int]] = {}

        current = start
        while current <= end:
            for category in CATEGORY_LABELS:
                redis_key = self._hash_key(current, category, scope_type, scope_id)
                bucket = self._hgetall(redis_key)
                if not bucket:
                    continue
                category_bucket = merged.setdefault(category, {})
                for field, value in bucket.items():
                    category_bucket[field] = category_bucket.get(field, 0) + int(value)
            current += timedelta(days=1)

        categories: list[ApiUsageCategoryStat] = []
        total_requests = 0
        total_errors = 0
        for category, label in CATEGORY_LABELS.items():
            fields = merged.get(category, {})
            route_stats: dict[str, tuple[int, int]] = {}
            for field, count in fields.items():
                if field.endswith(":err"):
                    route_key = field[:-4]
                    current_total, current_errors = route_stats.get(route_key, (0, 0))
                    route_stats[route_key] = (current_total, current_errors + count)
                else:
                    current_total, current_errors = route_stats.get(field, (0, 0))
                    route_stats[field] = (current_total + count, current_errors)

            routes = [
                ApiUsageRouteStat(
                    route_key=route_key,
                    label=ROUTE_LABELS.get(route_key, route_key),
                    total=counts[0],
                    errors=counts[1],
                )
                for route_key, counts in route_stats.items()
                if counts[0] > 0 or counts[1] > 0
            ]
            routes.sort(key=lambda item: item.total + item.errors, reverse=True)
            category_total = sum(route.total for route in routes)
            category_errors = sum(route.errors for route in routes)
            if category_total == 0 and category_errors == 0:
                continue
            total_requests += category_total
            total_errors += category_errors
            categories.append(
                ApiUsageCategoryStat(
                    category=category,
                    label=label,
                    total=category_total,
                    errors=category_errors,
                    routes=routes,
                )
            )

        categories.sort(key=lambda item: item.total + item.errors, reverse=True)
        return ApiUsageSummary(
            scope_type=scope_type,
            scope_id=scope_id,
            period_days=bounded_days,
            period_start=start,
            period_end=end,
            total_requests=total_requests,
            total_errors=total_errors,
            categories=categories,
        )

    def _hash_key(self, usage_date: date, category: str, scope_type: str, scope_id: str) -> str:
        return f"{self.PREFIX}:{usage_date.isoformat()}:{category}:{scope_type}:{scope_id}"

    def _hincr(self, key: str, field: str, amount: int) -> None:
        ttl_seconds = self.RETENTION_DAYS * 86400 + 3600
        if self._redis is not None:
            try:
                pipeline = self._redis.pipeline()
                pipeline.hincrby(key, field, amount)
                pipeline.expire(key, ttl_seconds)
                pipeline.execute()
                return
            except redis.RedisError:
                self._redis = None
        with self._local_lock:
            bucket = self._local_hashes.setdefault(key, {})
            bucket[field] = bucket.get(field, 0) + amount

    def _hgetall(self, key: str) -> dict[str, int]:
        if self._redis is not None:
            try:
                raw = self._redis.hgetall(key)
                if not raw:
                    return {}
                return {
                    (field.decode("utf-8") if isinstance(field, bytes) else str(field)): int(value)
                    for field, value in raw.items()
                }
            except redis.RedisError:
                self._redis = None
        with self._local_lock:
            return dict(self._local_hashes.get(key, {}))

    @staticmethod
    def _build_redis_client(redis_url: str) -> redis.Redis | None:
        try:
            client = redis.Redis.from_url(redis_url, decode_responses=False)
            client.ping()
            return client
        except redis.RedisError:
            return None


def normalize_route_key(route_key: str) -> str:
    normalized = (route_key or "").strip()
    if not normalized:
        return "UNKNOWN"
    if " " not in normalized:
        return normalized
    method, path = normalized.split(" ", 1)
    path = UUID_PATTERN.sub("{id}", path.strip())
    prefix = settings.api_v1_prefix.rstrip("/")
    if path.startswith(prefix):
        path = path[len(prefix) :]
    path = re.sub(r"/pay/[^/]+", "/pay/{token}", path)
    return f"{method.upper()} {path}"


def normalize_provider_path(path: str) -> str:
    normalized = (path or "").strip()
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    return normalized


def normalize_http_route(method: str, path: str) -> str:
    return normalize_route_key(f"{method.upper()} {path}")


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _resolve_scopes(
    *,
    tenant_id: str | None,
    project_id: str | None,
) -> list[tuple[str, str]]:
    scopes: list[tuple[str, str]] = [("platform", "global")]
    if project_id:
        scopes.append(("project", project_id))
    if tenant_id:
        scopes.append(("tenant", tenant_id))
    return scopes


@lru_cache
def get_api_usage_service() -> ApiUsageService:
    return ApiUsageService(settings.redis_url)
