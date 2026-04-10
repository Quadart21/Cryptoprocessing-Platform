from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _build_connect_args() -> dict[str, object]:
    options = []
    if settings.db_statement_timeout_ms > 0:
        options.append(f"-c statement_timeout={settings.db_statement_timeout_ms}")

    connect_args: dict[str, object] = {
        "connect_timeout": settings.db_connect_timeout_seconds,
    }
    if options:
        connect_args["options"] = " ".join(options)
    return connect_args


engine = create_engine(
    settings.sqlalchemy_database_uri,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout_seconds,
    pool_recycle=settings.db_pool_recycle_seconds,
    connect_args=_build_connect_args(),
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
)
