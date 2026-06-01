from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.services.connection_limit_service import (
    ConnectionLimitService,
    get_connection_limit_service,
)


class ConnectionLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, service: ConnectionLimitService | None = None):
        super().__init__(app)
        self.service = service or get_connection_limit_service()

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        limit = settings.max_concurrent_connections_per_ip
        if limit <= 0:
            return await call_next(request)

        client_ip = self._extract_client_ip(request)
        lease = self.service.acquire(client_key=client_ip)
        if lease is None:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Too many concurrent connections from this IP. Please retry later.",
                    "scope": "concurrent_connections_ip",
                    "limit": limit,
                },
                headers={"Retry-After": "5"},
            )

        try:
            return await call_next(request)
        finally:
            self.service.release(lease)

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
