from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
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
            ),
            RateLimitRule(
                name="auth_register_ip",
                method="POST",
                path=f"{prefix}/client/auth/register",
                limit=settings.rate_limit_register_ip_per_10m,
                window_seconds=600,
                key_mode="ip",
            ),
            RateLimitRule(
                name="auth_set_password_ip",
                method="POST",
                path=f"{prefix}/client/auth/set-password",
                limit=settings.rate_limit_register_ip_per_10m,
                window_seconds=600,
                key_mode="ip",
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
            ),
            RateLimitRule(
                name="twofactor_enable_auth",
                method="POST",
                path=f"{prefix}/client/security/2fa/enable",
                limit=settings.rate_limit_otp_per_minute,
                window_seconds=60,
                key_mode="ip_auth",
            ),
            RateLimitRule(
                name="twofactor_disable_auth",
                method="POST",
                path=f"{prefix}/client/security/2fa/disable",
                limit=settings.rate_limit_otp_per_minute,
                window_seconds=60,
                key_mode="ip_auth",
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
            ),
            RateLimitRule(
                name="public_pay_refresh_ip",
                method="POST",
                path=f"{prefix}/public/pay/{{payment_token}}/refresh",
                limit=settings.rate_limit_public_pay_refresh_ip_per_minute,
                window_seconds=60,
                key_mode="ip",
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
            ),
            RateLimitRule(
                name="2fa_enable_auth",
                method="POST",
                path=f"{prefix}/client/security/2fa/enable",
                limit=settings.rate_limit_2fa_enable_per_minute,
                window_seconds=60,
                key_mode="auth",
            ),
            RateLimitRule(
                name="payout_create_auth",
                method="POST",
                path=f"{prefix}/client/payouts",
                limit=settings.rate_limit_payout_create_per_minute,
                window_seconds=60,
                key_mode="auth",
            ),
        ]

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        method = request.method.upper()
        for rule in self.rules:
            if method != rule.method or not self._path_matches(path, rule.path):
                continue
            key = self._build_key(request, rule.key_mode)
            try:
                self.service.enforce(
                    scope=rule.name,
                    key=key,
                    limit=rule.limit,
                    window_seconds=rule.window_seconds,
                )
            except RateLimitExceededError as exc:
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please retry later.",
                        "scope": rule.name,
                        "retry_after": exc.retry_after,
                    },
                    headers={"Retry-After": str(exc.retry_after)},
                )
        return await call_next(request)

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
