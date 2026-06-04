from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

_usage_context: ContextVar["ProviderUsageContext | None"] = ContextVar(
    "provider_usage_context",
    default=None,
)


@dataclass(frozen=True)
class ProviderUsageContext:
    tenant_id: str | None
    project_id: str | None


def get_provider_usage_context() -> ProviderUsageContext | None:
    return _usage_context.get()


@contextmanager
def provider_usage_scope(*, tenant_id: str | None, project_id: str | None):
    token = _usage_context.set(
        ProviderUsageContext(tenant_id=tenant_id, project_id=project_id),
    )
    try:
        yield
    finally:
        _usage_context.reset(token)
