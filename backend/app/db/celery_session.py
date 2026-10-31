"""DB sessions for Celery workers (FORCE RLS requires an explicit security context)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.tenant import clear_db_security_context, set_db_security_context


@asynccontextmanager
async def celery_db_session(*, is_superadmin: bool = True) -> AsyncIterator[AsyncSession]:
    """Open a session with platform RLS bypass for background jobs."""
    db = AsyncSessionLocal()
    try:
        await set_db_security_context(db, tenant_id=None, is_superadmin=is_superadmin)
        yield db
    finally:
        clear_db_security_context()
        await db.close()
