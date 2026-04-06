from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, require_platform_permission
from app.models.tenant import Tenant
from app.models.user import User
from app.models.project import Project
from app.schemas.admin import TenantSummary, TenantCreateRequest, TenantCreateResponse
from app.services.tenant_service import TenantService
from app.services.auth_service import AuthService
from app.services.notification_service import NotificationService


@router.get("/tenants", response_model=list[TenantSummary])
async def list_tenants(
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[TenantSummary]:
    stmt = (
        select(Tenant, User)
        .join(User, User.tenant_id == Tenant.id)
        .where(User.role == "tenant_owner")
        .order_by(Tenant.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = list(db.execute(stmt).all())
    return [
        TenantSummary(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status,
            review_comment=tenant.review_comment,
            owner_email=owner.email,
        )
        for tenant, owner in rows
    ]


@router.post(
    "/tenants",
    response_model=TenantCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant(
    payload: TenantCreateRequest,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> TenantCreateResponse:
    tenant_service = TenantService(db)
    auth_service = AuthService(db)
    notification_service = NotificationService(db)

    try:
        tenant, owner, project_id, api_public_key, api_secret_key = (
            tenant_service.create_tenant_with_owner(payload)
        )
        invite_token = auth_service.create_invite(owner)

        await notification_service.send_tenant_created_notification(
            tenant, owner, project_id, api_public_key, api_secret_key, invite_token
        )

        return TenantCreateResponse(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status,
            owner_email=owner.email,
            project_id=project_id,
            api_public_key=api_public_key,
            api_secret_key=api_secret_key,
            invite_token=invite_token,
            created_at=tenant.created_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/tenants/{tenant_id}", response_model=TenantSummary)
async def get_tenant(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: Session = Depends(get_db),
) -> TenantSummary:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    
    owner = db.scalar(
        select(User)
        .where(User.tenant_id == tenant_id, User.role == "tenant_owner")
        .order_by(User.created_at.asc())
    )
    return TenantSummary(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        review_comment=tenant.review_comment,
        owner_email=owner.email if owner else "",
    )


@router.post("/tenants/{tenant_id}/approve", response_model=dict)
async def approve_tenant(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> dict:
    from app.services.project_service import ProjectService
    from app.services.notification_service import NotificationService

    tenant_service = TenantService(db)
    notification_service = NotificationService(db)

    try:
        tenant, project, owner, password, api_public_key, api_secret_key = (
            tenant_service.approve_tenant(tenant_id)
        )

        await notification_service.send_tenant_approved_notification(
            tenant, owner, password, api_public_key, api_secret_key
        )

        return {
            "id": tenant.id,
            "name": tenant.name,
            "status": tenant.status,
            "owner_email": owner.email,
            "project_id": project.id,
            "api_public_key": api_public_key,
            "api_secret_key": api_secret_key,
            "generated_password": password,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/tenants/{tenant_id}/reject", response_model=dict)
async def reject_tenant(
    tenant_id: str,
    payload: dict,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> dict:
    review_comment = payload.get("review_comment")
    tenant_service = TenantService(db)

    try:
        tenant = tenant_service.reject_tenant(tenant_id, review_comment)
        return {"id": tenant.id, "name": tenant.name, "status": tenant.status}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
