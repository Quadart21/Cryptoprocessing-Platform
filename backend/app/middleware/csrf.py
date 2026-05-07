from __future__ import annotations

import secrets
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.services.cache_service import get_cache_service

CSRF_TOKEN_LENGTH = 32
CSRF_TOKEN_TTL_SECONDS = 3600
CSRF_CACHE_KEY_PREFIX = "csrf"


def _csrf_cache_key(token: str) -> str:
    return f"{CSRF_CACHE_KEY_PREFIX}:{token}"


def generate_csrf_token() -> str:
    token = secrets.token_urlsafe(CSRF_TOKEN_LENGTH)
    get_cache_service().set_json(
        _csrf_cache_key(token),
        {"v": 1},
        ttl_seconds=CSRF_TOKEN_TTL_SECONDS,
    )
    return token


def _validate_and_touch_csrf_token(token: str) -> bool:
    cache = get_cache_service()
    key = _csrf_cache_key(token)
    if cache.get_json(key) is None:
        return False
    cache.set_json(key, {"v": 1}, ttl_seconds=CSRF_TOKEN_TTL_SECONDS)
    return True


class CsrfProtectionMiddleware(BaseHTTPMiddleware):
    """Require X-CSRF-Token for mutating requests under admin cabinet paths."""

    READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        method = request.method.upper()

        if method in self.READ_METHODS:
            response = await call_next(request)
            if method == "GET" and self._is_cabinet_request(path):
                response.headers["X-CSRF-Token"] = generate_csrf_token()
            return response

        if not self._is_cabinet_request(path):
            return await call_next(request)

        csrf_token = request.headers.get("X-CSRF-Token")
        if not csrf_token:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token is required."},
            )

        if not _validate_and_touch_csrf_token(csrf_token):
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid or expired CSRF token."},
            )

        return await call_next(request)

    def _is_cabinet_request(self, path: str) -> bool:
        cabinet_paths = (
            "/api/v1/admin",
            "/api/v1/tenant",
        )
        return any(path.startswith(p) for p in cabinet_paths)
