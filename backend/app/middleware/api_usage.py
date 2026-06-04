from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.services.api_key_context_cache import get_api_key_context_cache
from app.services.api_usage_service import get_api_usage_service, normalize_http_route


class ApiUsageMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        response = await call_next(request)
        try:
            await self._record_request(request, response.status_code)
        except Exception:
            pass
        return response

    async def _record_request(self, request: Request, status_code: int) -> None:
        path = request.url.path
        method = request.method.upper()
        route_key = normalize_http_route(method, path)
        service = get_api_usage_service()
        error = status_code >= 400
        prefix = settings.api_v1_prefix.rstrip("/")

        if path.startswith(f"{prefix}/client/"):
            public_key = (request.headers.get("x-api-key") or "").strip()
            tenant_id: str | None = None
            project_id: str | None = None
            if public_key:
                context = await get_api_key_context_cache().resolve(public_key)
                if context is not None:
                    tenant_id = context.tenant_id
                    project_id = context.project_id
            service.record(
                category="merchant_api",
                route_key=route_key,
                tenant_id=tenant_id,
                project_id=project_id,
                error=error,
            )
            return
