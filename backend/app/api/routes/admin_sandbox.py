from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_superadmin
from app.core.config import settings
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.sandbox import (
    SandboxCreateRequest,
    SandboxCreateResponse,
    SandboxProvisionDnsRequest,
    SandboxSettingsResponse,
    SandboxSettingsUpdateRequest,
    SandboxSummaryResponse,
)
from app.services.billing_policy_service import BillingPolicyService
from app.services.sandbox_service import SandboxService

router = APIRouter()

_DEFAULT_API_BASE = f"http://localhost:8000{settings.api_v1_prefix}"


async def _sandbox_settings_response(db: AsyncSession) -> SandboxSettingsResponse:
    billing = BillingPolicyService(db)
    configured, masked = await billing.describe_sandbox_cloudflare_token_for_admin()
    return SandboxSettingsResponse(
        cloudflare_token_configured=configured,
        cloudflare_token_masked=masked,
    )


def _summary(sandbox, tenant_name: str) -> SandboxSummaryResponse:
    return SandboxSummaryResponse(
        id=sandbox.id,
        tenant_id=sandbox.tenant_id,
        project_id=sandbox.project_id,
        label=sandbox.label,
        dns_parent_zone=sandbox.dns_parent_zone,
        desired_subdomain=sandbox.desired_subdomain,
        status=sandbox.status,
        public_base_url=sandbox.public_base_url,
        tenant_name=tenant_name,
        created_at=sandbox.created_at,
        origin_ipv4=sandbox.origin_ipv4,
        agent_public_id=sandbox.agent_public_id,
    )


@router.get("/settings", response_model=SandboxSettingsResponse)
async def get_sandbox_platform_settings(
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> SandboxSettingsResponse:
    return await _sandbox_settings_response(db)


@router.put("/settings", response_model=SandboxSettingsResponse)
async def put_sandbox_platform_settings(
    body: SandboxSettingsUpdateRequest,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> SandboxSettingsResponse:
    if body.cloudflare_api_token is not None:
        billing = BillingPolicyService(db)
        await billing.set_sandbox_cloudflare_api_token(body.cloudflare_api_token)
    return await _sandbox_settings_response(db)


@router.get("", response_model=list[SandboxSummaryResponse])
async def list_merchant_sandboxes(
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> list[SandboxSummaryResponse]:
    svc = SandboxService(db)
    rows = await svc.list_sandboxes(limit=100)
    return [_summary(sandbox, tenant.name) for sandbox, tenant in rows]


@router.post("", response_model=SandboxCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_merchant_sandbox(
    body: SandboxCreateRequest,
    admin_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> SandboxCreateResponse:
    svc = SandboxService(db)
    try:
        outcome = await svc.create_sandbox(
            admin_user_id=admin_user.id,
            label=body.label,
            dns_parent_zone=body.dns_parent_zone,
            desired_subdomain=body.desired_subdomain,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    sb = outcome.sandbox
    expires = sb.enrollment_expires_at or datetime.now(sb.created_at.tzinfo)
    api_base = (settings.public_api_base_url or "").strip().rstrip("/") or _DEFAULT_API_BASE
    return SandboxCreateResponse(
        id=sb.id,
        tenant_id=sb.tenant_id,
        project_id=sb.project_id or "",
        label=sb.label,
        dns_parent_zone=sb.dns_parent_zone,
        desired_subdomain=sb.desired_subdomain,
        status=sb.status,
        enrollment_token=outcome.enrollment_token,
        enrollment_expires_at=expires,
        api_public_key=outcome.api_public_key,
        api_secret_key=outcome.api_secret_key,
        owner_email=outcome.owner_email,
        owner_password=outcome.owner_password,
        public_api_base_url=api_base,
    )


@router.post("/{sandbox_id}/provision-dns", response_model=SandboxSummaryResponse)
async def provision_sandbox_dns_admin(
    sandbox_id: str,
    body: SandboxProvisionDnsRequest,
    admin_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> SandboxSummaryResponse:
    svc = SandboxService(db)
    try:
        sandbox = await svc.provision_dns(
            sandbox_id=sandbox_id,
            ipv4=body.ipv4,
            proxied=body.proxied,
            admin_user_id=admin_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    tenant = await db.get(Tenant, sandbox.tenant_id)
    name = tenant.name if tenant else "—"
    return _summary(sandbox, name)


@router.delete("/{sandbox_id}", status_code=status.HTTP_204_NO_CONTENT)
async def destroy_merchant_sandbox(
    sandbox_id: str,
    admin_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    svc = SandboxService(db)
    try:
        await svc.destroy_sandbox(sandbox_id=sandbox_id, admin_user_id=admin_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{sandbox_id}", response_model=SandboxSummaryResponse)
async def get_merchant_sandbox(
    sandbox_id: str,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> SandboxSummaryResponse:
    svc = SandboxService(db)
    sandbox = await svc.get_sandbox(sandbox_id)
    if sandbox is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Песочница не найдена.")
    tenant = await db.get(Tenant, sandbox.tenant_id)
    name = tenant.name if tenant else "—"
    return _summary(sandbox, name)
