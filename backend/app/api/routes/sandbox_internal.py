"""Публичные для инфраструктуры точки (агент на VPS): без JWT админки."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_sandbox_agent
from app.models.merchant_sandbox import MerchantSandbox
from app.models.tenant import Tenant
from app.schemas.sandbox import SandboxEnrollRequest, SandboxEnrollResponse, SandboxProvisionDnsRequest, SandboxSummaryResponse
from app.services.sandbox_service import SandboxService

router = APIRouter()


@router.post("/sandbox/enroll", response_model=SandboxEnrollResponse)
async def enroll_sandbox_agent(
    body: SandboxEnrollRequest,
    db: AsyncSession = Depends(get_db),
) -> SandboxEnrollResponse:
    svc = SandboxService(db)
    try:
        agent_token, meta = await svc.enroll_agent(
            sandbox_id=body.sandbox_id,
            enrollment_token=body.enrollment_token,
            agent_instance_id=body.agent_instance_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return SandboxEnrollResponse(
        agent_api_token=agent_token,
        public_api_base_url=meta["public_api_base_url"],
        desired_public_base_url=meta["desired_public_base_url"],
        tenant_id=meta["tenant_id"],
        project_id=meta["project_id"],
        agent_public_id=meta["agent_public_id"],
    )


@router.post("/sandbox/provision-dns", response_model=SandboxSummaryResponse)
async def provision_sandbox_dns_agent(
    body: SandboxProvisionDnsRequest,
    sandbox: MerchantSandbox = Depends(require_sandbox_agent),
    db: AsyncSession = Depends(get_db),
) -> SandboxSummaryResponse:
    svc = SandboxService(db)
    try:
        updated = await svc.provision_dns(
            sandbox_id=sandbox.id,
            ipv4=body.ipv4,
            proxied=body.proxied,
            admin_user_id=None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tenant = await db.get(Tenant, updated.tenant_id)
    name = tenant.name if tenant else "—"
    return SandboxSummaryResponse(
        id=updated.id,
        tenant_id=updated.tenant_id,
        project_id=updated.project_id,
        label=updated.label,
        dns_parent_zone=updated.dns_parent_zone,
        desired_subdomain=updated.desired_subdomain,
        status=updated.status,
        public_base_url=updated.public_base_url,
        tenant_name=name,
        created_at=updated.created_at,
        origin_ipv4=updated.origin_ipv4,
        agent_public_id=updated.agent_public_id,
    )
