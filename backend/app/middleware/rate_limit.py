from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.services.api_key_context_cache import get_api_key_context_cache
from app.services.api_key_tenant_cache import get_api_key_tenant_cache
from app.services.api_usage_service import get_api_usage_service
from app.services.rate_limit_burst import resolve_burst_limit
from app.services.rate_limit_service import (
    RateLimitExceededError,
    RateLimitService,
    get_rate_limit_service,
)

KeyMode = Literal["ip", "auth", "ip_auth"]


@dataclass(frozen=True)
class RateLimitRule:
    name: str
    method: str
    path: str
    limit: int
    window_seconds: int
    key_mode: KeyMode
    burst_limit: int | None = None


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, service: RateLimitService | None = None):
        super().__init__(app)
        self.service = service or get_rate_limit_service()
        prefix = settings.api_v1_prefix.rstrip("/")
        self.rules = [
            RateLimitRule(
                name="auth_login_ip",
                method="POST",
                path=f"{prefix}/client/auth/login",
                limit=settings.rate_limit_login_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
                burst_limit=5,
            ),
            RateLimitRule(
                name="auth_register_ip",
                method="POST",
                path=f"{prefix}/client/auth/register",
                limit=settings.rate_limit_register_ip_per_10m,
                window_seconds=600,
                key_mode="ip",
                burst_limit=3,
            ),
            RateLimitRule(
                name="auth_set_password_ip",
                method="POST",
                path=f"{prefix}/client/auth/set-password",
                limit=settings.rate_limit_register_ip_per_10m,
                window_seconds=600,
                key_mode="ip",
                burst_limit=3,
            ),
            RateLimitRule(
                name="invoice_create_ip",
                method="POST",
                path=f"{prefix}/client/invoices",
                limit=settings.rate_limit_invoice_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="invoice_create_auth",
                method="POST",
                path=f"{prefix}/client/invoices",
                limit=settings.rate_limit_invoice_auth_per_minute,
                window_seconds=60,
                key_mode="auth",
            ),
            RateLimitRule(
                name="read_rates_ip",
                method="GET",
                path=f"{prefix}/client/rates",
                limit=settings.rate_limit_read_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="read_invoices_ip",
                method="GET",
                path=f"{prefix}/client/invoices",
                limit=settings.rate_limit_read_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="read_transactions_ip",
                method="GET",
                path=f"{prefix}/client/transactions",
                limit=settings.rate_limit_read_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="read_balance_ip",
                method="GET",
                path=f"{prefix}/client/balance",
                limit=settings.rate_limit_read_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="read_accounting_ip",
                method="GET",
                path=f"{prefix}/client/accounting/summary",
                limit=settings.rate_limit_read_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="webhook_test_ip",
                method="POST",
                path=f"{prefix}/client/webhooks/test",
                limit=settings.rate_limit_webhook_test_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="webhook_test_auth",
                method="POST",
                path=f"{prefix}/client/webhooks/test",
                limit=settings.rate_limit_webhook_test_auth_per_minute,
                window_seconds=60,
                key_mode="auth",
            ),
            RateLimitRule(
                name="twofactor_setup_auth",
                method="POST",
                path=f"{prefix}/client/security/2fa/setup",
                limit=settings.rate_limit_otp_per_minute,
                window_seconds=60,
                key_mode="ip_auth",
                burst_limit=5,
            ),
            RateLimitRule(
                name="twofactor_enable_auth",
                method="POST",
                path=f"{prefix}/client/security/2fa/enable",
                limit=settings.rate_limit_otp_per_minute,
                window_seconds=60,
                key_mode="ip_auth",
                burst_limit=5,
            ),
            RateLimitRule(
                name="twofactor_disable_auth",
                method="POST",
                path=f"{prefix}/client/security/2fa/disable",
                limit=settings.rate_limit_otp_per_minute,
                window_seconds=60,
                key_mode="ip_auth",
                burst_limit=5,
            ),
            RateLimitRule(
                name="internal_webhook_ip",
                method="POST",
                path="/internal/webhook/crypto-cash",
                limit=settings.rate_limit_internal_webhook_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="public_pay_read_ip",
                method="GET",
                path=f"{prefix}/public/pay/{{payment_token}}",
                limit=settings.rate_limit_read_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
                burst_limit=20,
            ),
            RateLimitRule(
                name="public_pay_refresh_ip",
                method="POST",
                path=f"{prefix}/public/pay/{{payment_token}}/refresh",
                limit=settings.rate_limit_public_pay_refresh_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
                burst_limit=8,
            ),
            RateLimitRule(
                name="sandbox_enroll_ip",
                method="POST",
                path="/internal/sandbox/enroll",
                limit=settings.rate_limit_sandbox_enroll_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
            ),
            RateLimitRule(
                name="set_password_ip",
                method="POST",
                path=f"{prefix}/client/auth/set-password",
                limit=settings.rate_limit_set_password_per_minute,
                window_seconds=60,
                key_mode="ip",
                burst_limit=3,
            ),
            RateLimitRule(
                name="2fa_enable_auth",
                method="POST",
                path=f"{prefix}/client/security/2fa/enable",
                limit=settings.rate_limit_2fa_enable_per_minute,
                window_seconds=60,
                key_mode="auth",
                burst_limit=3,
            ),
            RateLimitRule(
                name="payout_create_auth",
                method="POST",
                path=f"{prefix}/client/payouts",
                limit=settings.rate_limit_payout_create_per_minute,
                window_seconds=60,
                key_mode="auth",
                burst_limit=2,
            ),
        ]

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        method = request.method.upper()

        if settings.rate_limit_burst_enabled and settings.rate_limit_global_burst_ip_limit > 0:
            try:
                self._enforce_global_burst(request)
            except RateLimitExceededError as exc:
                await self._record_rate_limit_hit(request, exc)
                return self._rate_limit_response(exc)

        try:
            await self._enforce_api_key_account_limit(request)
        except RateLimitExceededError as exc:
            await self._record_rate_limit_hit(request, exc)
            return self._rate_limit_response(exc)

        for rule in self.rules:
            if method != rule.method or not self._path_matches(path, rule.path):
                continue
            try:
                self._enforce_rule(request, rule)
            except RateLimitExceededError as exc:
                await self._record_rate_limit_hit(request, exc)
                return self._rate_limit_response(exc)
        return await call_next(request)

    async def _record_rate_limit_hit(self, request: Request, exc: RateLimitExceededError) -> None:
        tenant_id: str | None = None
        project_id: str | None = None
        public_key = (request.headers.get("x-api-key") or "").strip()
        if public_key:
            context = await get_api_key_context_cache().resolve(public_key)
            if context is not None:
                tenant_id = context.tenant_id
                project_id = context.project_id
        get_api_usage_service().record_rate_limit_hit(
            scope=exc.scope,
            tenant_id=tenant_id,
            project_id=project_id,
        )

    def _enforce_global_burst(self, request: Request) -> None:
        ip_key = self._extract_client_ip(request)
        self.service.enforce(
            scope="global_burst_ip",
            key=ip_key,
            limit=settings.rate_limit_global_burst_ip_limit,
            window_seconds=settings.rate_limit_global_burst_ip_window_seconds,
            layer="burst",
        )

    async def _enforce_api_key_account_limit(self, request: Request) -> None:
        if settings.rate_limit_api_key_account_per_minute <= 0:
            return
        public_key = (request.headers.get("x-api-key") or "").strip()
        if not public_key or not self._is_client_api_path(request.url.path):
            return

        tenant_id = await get_api_key_tenant_cache().resolve_tenant_id(public_key)
        account_key = tenant_id or f"unknown:{public_key[:16]}"

        burst_window = settings.rate_limit_burst_window_seconds
        burst_limit = settings.rate_limit_api_key_account_burst
        if settings.rate_limit_burst_enabled and burst_limit > 0:
            self.service.enforce(
                scope="api_key_account:burst",
                key=account_key,
                limit=burst_limit,
                window_seconds=burst_window,
                layer="burst",
            )

        self.service.enforce(
            scope="api_key_account",
            key=account_key,
            limit=settings.rate_limit_api_key_account_per_minute,
            window_seconds=60,
            layer="sustained",
        )

    def _is_client_api_path(self, path: str) -> bool:
        prefix = f"{settings.api_v1_prefix.rstrip('/')}/client/"
        return path.startswith(prefix)

    def _enforce_rule(self, request: Request, rule: RateLimitRule) -> None:
        key = self._build_key(request, rule.key_mode)
        burst_window = settings.rate_limit_burst_window_seconds

        if settings.rate_limit_burst_enabled:
            burst_limit = rule.burst_limit
            if burst_limit is None:
                burst_limit = resolve_burst_limit(
                    sustained_limit=rule.limit,
                    window_seconds=rule.window_seconds,
                    burst_window_seconds=burst_window,
                )
            if burst_limit > 0:
                self.service.enforce(
                    scope=f"{rule.name}:burst",
                    key=key,
                    limit=burst_limit,
                    window_seconds=burst_window,
                    layer="burst",
                )

        self.service.enforce(
            scope=rule.name,
            key=key,
            limit=rule.limit,
            window_seconds=rule.window_seconds,
            layer="sustained",
        )

    @staticmethod
    def _rate_limit_response(exc: RateLimitExceededError) -> JSONResponse:
        detail = (
            "API key account rate limit exceeded. Please retry later."
            if exc.scope.startswith("api_key_account")
            else (
                "Too many requests in a short period. Please retry later."
                if exc.layer == "burst"
                else "Too many requests. Please retry later."
            )
        )
        return JSONResponse(
            status_code=429,
            content={
                "detail": detail,
                "scope": exc.scope,
                "layer": exc.layer,
                "retry_after": exc.retry_after,
            },
            headers={"Retry-After": str(exc.retry_after)},
        )

    @staticmethod
    def _path_matches(path: str, rule_path: str) -> bool:
        if "{" not in rule_path:
            return path == rule_path
        parts = re.split(r"(\{[^}]+\})", rule_path)
        pattern_parts: list[str] = []
        for part in parts:
            if part.startswith("{") and part.endswith("}"):
                pattern_parts.append("[^/]+")
            elif part:
                pattern_parts.append(re.escape(part))
        pattern = "^" + "".join(pattern_parts) + "$"
        return re.match(pattern, path) is not None

    def _build_key(self, request: Request, mode: KeyMode) -> str:
        ip_key = self._extract_client_ip(request)
        auth_key = self._extract_auth_identity(request)
        if mode == "ip":
            return ip_key
        if mode == "auth":
            return auth_key
        return f"{ip_key}:{auth_key}"

    @staticmethod
    def _extract_client_ip(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for:
            first = forwarded_for.split(",")[0].strip()
            if first:
                return first
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    @staticmethod
    def _extract_auth_identity(request: Request) -> str:
        api_key = (request.headers.get("x-api-key") or "").strip()
        if api_key:
            return f"api_key:{api_key}"
        authorization = (request.headers.get("authorization") or "").strip()
        if authorization:
            return authorization
        return "anonymous"
