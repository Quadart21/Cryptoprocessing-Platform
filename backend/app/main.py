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
from app.api.router import api_router
from app.core.config import settings
from app.db.bootstrap import ensure_database_ready
from app.middleware.rate_limit import RateLimitMiddleware

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_INDEX_FILE = FRONTEND_DIST_DIR / "index.html"
SPA_RESERVED_PREFIXES = (
    settings.api_v1_prefix.lstrip("/"),
    "internal",
    "docs",
    "openapi.json",
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
    yield


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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    _register_error_handlers(app)
    _register_security_headers(app)

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    app.include_router(internal_router, prefix="/internal", tags=["internal"])
    _register_merchant_docs_routes(app)
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

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, HTTPException):
            detail = exc.detail if isinstance(exc.detail, str) else "Request error."
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": detail, "code": "request_error"},
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


def _register_frontend_routes(app: FastAPI) -> None:
    if not FRONTEND_INDEX_FILE.exists():
        return

    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def spa_root() -> FileResponse:
        return FileResponse(FRONTEND_INDEX_FILE)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str, request: Request) -> FileResponse:
        normalized = full_path.strip("/")
        if not normalized:
            return FileResponse(FRONTEND_INDEX_FILE)

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
            return FileResponse(FRONTEND_INDEX_FILE)
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


app = create_application()
