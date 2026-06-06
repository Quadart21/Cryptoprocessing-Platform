import logging
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from app.api.routes.internal import router as internal_router
from app.api.routes.sandbox_internal import router as sandbox_internal_router
from app.api.router import api_router
from app.core.config import settings
from app.providers.crypto_cash import CryptoCashProviderError, provider_error_http_status
from app.db.bootstrap import ensure_database_ready
from app.db.session import AsyncSessionLocal
from app.services.brand_logo_service import BrandLogoService
from app.services.seo_service import SeoService
from app.services.spa_seo_html import load_index_template, render_spa_index_html
from app.middleware.api_usage import ApiUsageMiddleware
from app.middleware.connection_limit import ConnectionLimitMiddleware
from app.middleware.csrf import CsrfProtectionMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_INDEX_FILE = FRONTEND_DIST_DIR / "index.html"
UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
SPA_RESERVED_PREFIXES = (
    settings.api_v1_prefix.lstrip("/"),
    "internal",
    "docs",
    "openapi.json",
    "uploads",
)
MERCHANT_OPENAPI_ALLOWLIST: set[tuple[str, str]] = {
    ("GET", f"{settings.api_v1_prefix}/client/health"),
    ("POST", f"{settings.api_v1_prefix}/client/auth/login"),
    ("POST", f"{settings.api_v1_prefix}/client/invoices"),
    ("GET", f"{settings.api_v1_prefix}/client/invoices"),
    ("GET", f"{settings.api_v1_prefix}/client/invoices/{{invoice_id}}"),
    ("POST", f"{settings.api_v1_prefix}/client/invoices/{{invoice_id}}/sync"),
    ("GET", f"{settings.api_v1_prefix}/client/balance"),
    ("GET", f"{settings.api_v1_prefix}/client/rates"),
    ("GET", f"{settings.api_v1_prefix}/client/transactions"),
    ("GET", f"{settings.api_v1_prefix}/client/transactions/{{transaction_id}}"),
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_database_ready()
    BrandLogoService.ensure_upload_dir()
    from app.db.session import AsyncSessionLocal
    from app.services.billing_policy_service import BillingPolicyService
    from app.services.crypto_cash_rates_cache import get_crypto_cash_rates_cache

    rates_cache = get_crypto_cash_rates_cache()
    async with AsyncSessionLocal() as session:
        price_field = await BillingPolicyService(session).get_exchange_rate_price_field()
    rates_cache.set_price_field(price_field)
    rates_cache.start_polling()
    try:
        yield
    finally:
        rates_cache.stop_polling()


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(ApiUsageMiddleware)
    app.add_middleware(ConnectionLimitMiddleware)
    app.add_middleware(CsrfProtectionMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-CSRF-Token"],
    )
    _register_error_handlers(app)
    _register_security_headers(app)

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    app.include_router(internal_router, prefix="/internal", tags=["internal"])
    app.include_router(sandbox_internal_router, prefix="/internal", tags=["sandbox-agent"])
    _register_merchant_docs_routes(app)
    _register_admin_docs_routes(app)
    _register_frontend_routes(app)
    return app


def _register_security_headers(app: FastAPI) -> None:
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        api_prefix = settings.api_v1_prefix.rstrip("/")
        path = request.url.path
        if path.startswith(f"{api_prefix}/") or path.startswith("/internal"):
            response.headers.setdefault("Cross-Origin-Resource-Policy", "cross-origin")
        else:
            response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        return response


def _register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details: list[dict[str, str]] = []
        for item in exc.errors():
            details.append(
                {
                    "field": ".".join(str(part) for part in item.get("loc", [])),
                    "message": str(item.get("msg", "Validation error")),
                }
            )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Validation error.",
                "code": "validation_error",
                "errors": details,
            },
        )

    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(_: Request, __: IntegrityError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": "Data conflict. Check unique fields and try again.",
                "code": "integrity_conflict",
            },
        )

    @app.exception_handler(CryptoCashProviderError)
    async def handle_provider_error(_: Request, exc: CryptoCashProviderError) -> JSONResponse:
        logger.warning(
            "Crypto-Cash provider error: %s (path=%s, http_status=%s)",
            exc.message,
            exc.path,
            exc.http_status,
        )
        return JSONResponse(
            status_code=provider_error_http_status(exc),
            content=exc.to_public_detail(),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, HTTPException):
            detail = exc.detail if isinstance(exc.detail, str) else "Request error."
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": detail, "code": "request_error"},
            )
        logger.exception(
            "Unhandled application error for %s %s",
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error. Please try again later.",
                "code": "internal_error",
            },
        )


def _register_merchant_docs_routes(app: FastAPI) -> None:
    @app.get("/openapi.json", include_in_schema=False)
    async def merchant_openapi_json() -> JSONResponse:
        return JSONResponse(_build_merchant_openapi_schema(app))

    @app.get("/docs", include_in_schema=False)
    async def merchant_docs() -> HTMLResponse:
        return get_swagger_ui_html(
            openapi_url="/openapi.json",
            title=f"{settings.app_name} - Merchant API Docs",
        )


def _register_admin_docs_routes(app: FastAPI) -> None:
    if not settings.is_local_env:
        return

    @app.get("/admin/openapi.json", include_in_schema=False)
    async def admin_openapi_json() -> JSONResponse:
        return JSONResponse(_build_admin_openapi_schema(app))

    @app.get("/admin/docs", include_in_schema=False)
    async def admin_docs() -> HTMLResponse:
        return get_swagger_ui_html(
            openapi_url="/admin/openapi.json",
            title=f"{settings.app_name} - Admin API Docs",
            swagger_ui_parameters={
                "persistAuthorization": True,
                "tryItOutEnabled": True,
                "fetchCredentials": "include",
                "supportedSubmitMethods": ["get", "post", "put", "delete", "patch"],
            },
        )


def _register_frontend_routes(app: FastAPI) -> None:
    BrandLogoService.ensure_upload_dir()
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="platform-uploads")

    if not FRONTEND_INDEX_FILE.exists():
        return

    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    index_template_path = str(FRONTEND_INDEX_FILE.resolve())

    async def spa_index_html_response() -> HTMLResponse:
        template = load_index_template(index_template_path)
        async with AsyncSessionLocal() as session:
            seo = await SeoService(session).get_public_settings()
        body = render_spa_index_html(template, seo)
        return HTMLResponse(content=body, media_type="text/html")

    @app.get("/", include_in_schema=False)
    async def spa_root() -> HTMLResponse:
        return await spa_index_html_response()

    @app.get("/{full_path:path}", include_in_schema=False, response_model=None)
    async def spa_fallback(full_path: str, request: Request) -> FileResponse | HTMLResponse:
        normalized = full_path.strip("/")
        if not normalized:
            return await spa_index_html_response()

        if any(
            normalized == prefix or normalized.startswith(f"{prefix}/")
            for prefix in SPA_RESERVED_PREFIXES
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

        candidate = (FRONTEND_DIST_DIR / normalized).resolve()
        if FRONTEND_DIST_DIR in candidate.parents and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)

        # Vite SPA: every unknown path should resolve to index.html
        if "text/html" in (request.headers.get("accept") or ""):
            return await spa_index_html_response()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


@lru_cache(maxsize=1)
def _build_merchant_openapi_schema(app: FastAPI) -> dict:
    merchant_routes = [
        route
        for route in app.routes
        if isinstance(route, APIRoute)
        and any((method, route.path) in MERCHANT_OPENAPI_ALLOWLIST for method in route.methods)
    ]
    return get_openapi(
        title=f"{settings.app_name} Merchant API",
        version="0.1.0",
        description=(
            "OpenAPI schema for merchant integration endpoints only. "
            "Admin and internal routes are intentionally excluded."
        ),
        routes=merchant_routes,
    )


ADMIN_OPENAPI_ALLOWLIST: set[tuple[str, str]] = {
    ("GET", f"{settings.api_v1_prefix}/admin/health"),
    ("GET", f"{settings.api_v1_prefix}/admin/security/health"),
    ("GET", f"{settings.api_v1_prefix}/admin/security/csrf"),
}


@lru_cache(maxsize=1)
def _build_admin_openapi_schema(app: FastAPI) -> dict:
    admin_routes = [
        route
        for route in app.routes
        if isinstance(route, APIRoute)
        and route.path.startswith(f"{settings.api_v1_prefix}/admin")
    ]
    
    schema = get_openapi(
        title=f"{settings.app_name} Admin API",
        version="0.1.0",
        description=(
            "OpenAPI schema for admin panel endpoints. "
            "Requires authentication and CSRF token for mutations."
        ),
        routes=admin_routes,
    )
    
    schema.setdefault("components", {})
    schema["components"].setdefault("securitySchemes", {})
    schema["components"]["securitySchemes"]["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "description": "JWT access token. Get it from /api/v1/client/auth/login",
    }
    schema["components"]["securitySchemes"]["CsrfToken"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-CSRF-Token",
        "description": "CSRF token required for all POST/PUT/DELETE requests. Get it from response headers or /api/v1/admin/security/csrf",
    }
    
    for path, path_item in schema.get("paths", {}).items():
        for method, operation in path_item.items():
            if method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
                operation.setdefault("security", [{"BearerAuth": []}, {"CsrfToken": []}])
    
    return schema


app = create_application()
