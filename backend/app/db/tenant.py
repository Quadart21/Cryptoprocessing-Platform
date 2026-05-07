from contextvars import ContextVar

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

tenant_context: ContextVar[str | None] = ContextVar("tenant_context", default=None)
superadmin_context: ContextVar[bool] = ContextVar("superadmin_context", default=False)


def set_current_tenant(tenant_id: str | None) -> None:
    tenant_context.set(tenant_id)


def get_current_tenant() -> str | None:
    return tenant_context.get()


def set_superadmin_mode(enabled: bool) -> None:
    superadmin_context.set(enabled)


def is_superadmin_mode() -> bool:
    return superadmin_context.get()


def clear_db_security_context() -> None:
    tenant_context.set(None)
    superadmin_context.set(False)


async def apply_db_security_context(db: AsyncSession) -> None:
    tenant_id = get_current_tenant() or ""
    superadmin_flag = "on" if is_superadmin_mode() else "off"

    await db.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": tenant_id},
    )
    await db.execute(
        text("SELECT set_config('app.is_superadmin', :is_superadmin, true)"),
        {"is_superadmin": superadmin_flag},
    )


async def set_db_security_context(
    db: AsyncSession,
    *,
    tenant_id: str | None,
    is_superadmin: bool,
) -> None:
    set_current_tenant(tenant_id)
    set_superadmin_mode(is_superadmin)
    await apply_db_security_context(db)
