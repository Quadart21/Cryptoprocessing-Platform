from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings


@dataclass
class CsrfToken:
    token: str
    created_at: float
    expires_at: float


@lru_cache(maxsize=1)
def get_csrf_middleware() -> CsrfProtectionMiddleware:
    return CsrfProtectionMiddleware(None)


def generate_csrf_token() -> str:
    return get_csrf_middleware().generate_csrf_token()


class CsrfProtectionMiddleware(BaseHTTPMiddleware):
    TOKEN_LENGTH = 32
    TOKEN_LIFETIME_SECONDS = 3600
    CLEANUP_INTERVAL_SECONDS = 300
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "DELETE", "PATCH", "POST", "PUT"}

    def __init__(self, app):
        super().__init__(app)
        self._tokens: dict[str, CsrfToken] = {}
        self._last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        method = request.method.upper()

        if method in self.SAFE_METHODS:
            return await call_next(request)

        if not self._is_cabinet_request(path):
            return await call_next(request)

        self._cleanup_old_tokens()

        csrf_token = request.headers.get("X-CSRF-Token")
        if not csrf_token:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token is required."},
            )

        if not self._validate_token(csrf_token):
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid or expired CSRF token."},
            )

        response = await call_next(request)

        if method == "GET":
            new_token = self._generate_token()
            response.headers["X-CSRF-Token"] = new_token

        return response

    def generate_csrf_token(self) -> str:
        return self._generate_token()

    def _generate_token(self) -> str:
        token = secrets.token_urlsafe(self.TOKEN_LENGTH)
        now = time.time()
        self._tokens[token] = CsrfToken(
            token=token,
            created_at=now,
            expires_at=now + self.TOKEN_LIFETIME_SECONDS,
        )
        return token

    def _validate_token(self, token: str) -> bool:
        csrf_token = self._tokens.get(token)
        if csrf_token is None:
            return False
        if time.time() > csrf_token.expires_at:
            del self._tokens[token]
            return False
        csrf_token.expires_at = time.time() + self.TOKEN_LIFETIME_SECONDS
        return True

    def _cleanup_old_tokens(self) -> float:
        now = time.time()
        if now - self._last_cleanup < self.CLEANUP_INTERVAL_SECONDS:
            return self._last_cleanup

        expired_keys = [k for k, v in self._tokens.items() if now > v.expires_at]
        for k in expired_keys:
            self._tokens.pop(k, None)

        self._last_cleanup = now
        return now

    def _is_cabinet_request(self, path: str) -> bool:
        cabinet_prefix = "/api/v1/admin"
        cabinet_paths = {
            "/api/v1/admin",
            "/api/v1/tenant",
        }
        return any(path.startswith(p) for p in cabinet_paths)
