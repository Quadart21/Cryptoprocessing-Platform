from decimal import Decimal
from secrets import choice
from string import ascii_letters, digits

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    require_any_platform_permission,
    require_platform_permission,
    require_platform_user,
    user_permissions,
)
from app.core.rbac import list_role_definitions
from app.models.invoice import Invoice
from app.models.invite_token import InviteToken
from app.models.api_key import ApiKey
from app.models.ledger_entry import LedgerEntry
from app.models.provider_event import ProviderEvent
from app.models.project import Project
from app.models.payout_request import PayoutRequest
from app.models.tenant_balance import TenantBalance
from app.models.tenant_fee_policy import TenantFeePolicy
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.accounting import AccountingSummaryResponse
from app.schemas.assets import (
    AssetAvailabilityUpdateRequest,
    AssetAvailabilityUpdateResponse,
)
from app.schemas.billing import (
    ExchangeRateLookupResponse,
    ExchangeRateRefreshResponse,
    PlatformBillingSettingsResponse,
    PlatformBillingSettingsUpdateRequest,
    SmtpBzTestRequest,
    SmtpBzTestResponse,
    TelegramAdminTestRequest,
    TelegramAdminTestResponse,
    TelegramBotIdentityResponse,
    TelegramBotInspectRequest,
    TenantBillingPolicyResponse,
    TenantBillingPolicyUpdateRequest,
)
from app.schemas.admin import TenantDetailResponse, TenantOwnerSummary
from app.schemas.invoice import (
    InvoiceAdminDetailResponse,
    InvoiceResponse,
    InvoiceStatusUpdateRequest,
)
from app.schemas.project import (
    ApiKeyRegenerateResponse,
    ApiKeySummary,
    ProjectAdminUpdateRequest,
    ProjectSummary,
)
from app.schemas.payout import PayoutRequestResponse, PayoutReviewRequest
from app.schemas.public_page import (
    PublicPageCreateRequest,
    PublicPageResponse,
    PublicPageUpdateRequest,
)
from app.schemas.rates import RatesResponse
from app.schemas.tenant import (
    TenantAdminUpdateRequest,
    TenantApprovalRequest,
    TenantCreateRequest,
    TenantCreateResponse,
    TenantSummary,
)
from app.schemas.transaction import TransactionResponse
from app.schemas.user import CurrentUserResponse
from app.schemas.user_management import (
    UserCreateRequest,
    UserCreateResponse,
    UserRoleDefinitionResponse,
    UserSummaryResponse,
    UserUpdateRequest,
)
from app.services.auth_service import AuthService
from app.services.accounting_service import AccountingService
from app.services.billing_policy_service import BillingPolicyService
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.invoice_service import InvoiceService
from app.services.notification_service import NotificationService
from app.services.project_service import ProjectService
from app.services.payout_service import PayoutService
from app.services.rates_service import RatesService
from app.services.public_page_service import PublicPageService
from app.services.tenant_service import TenantService
from app.services.transaction_service import TransactionService
from app.services.user_service import UserService

from fastapi import APIRouter

router = APIRouter()


def _generate_temporary_password(length: int = 14) -> str:
    alphabet = ascii_letters + digits + "!@#$%^&*"
    return "".join(choice(alphabet) for _ in range(length))


@router.get("/health")
async def admin_health() -> dict[str, str]:
    return {"status": "ok", "scope": "admin"}


@router.get("/tenants", response_model=list[TenantSummary])
async def list_tenants(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: Session = Depends(get_db),
) -> list[TenantSummary]:
    tenant_service = TenantService(db)
    tenant_rows = tenant_service.list_tenants(limit=limit, offset=offset)
    return [
        TenantSummary(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status,
            review_comment=tenant.review_comment,
            owner_email=owner.email,
        )
        for tenant, owner in tenant_rows
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
) -> TenantSummary:
    tenant_service = TenantService(db)
    auth_service = AuthService(db)
    notification_service = NotificationService(db)

    try:
        tenant, owner, project_id, api_public_key, api_secret_key = (
            tenant_service.create_tenant_with_owner(payload)
        )
        invite_token = auth_service.create_invite(owner)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось создать tenant: {exc}",
        ) from exc

    notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_API_KEY_GENERATED,
        subject="Проект создан администратором",
        lines=[
            f"Проект: {tenant.name}",
            f"Public key: {api_public_key}",
            f"Secret key: {api_secret_key}",
            f"Invite token: {invite_token}",
        ],
    )

    return TenantCreateResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        review_comment=tenant.review_comment,
        owner_email=owner.email,
        invite_token=invite_token,
        project_id=project_id,
        api_public_key=api_public_key,
        api_secret_key=api_secret_key,
    )


@router.get("/me", response_model=CurrentUserResponse)
async def admin_me(current_user: User = Depends(require_platform_user)) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=current_user.id,
        tenant_id=current_user.tenant_id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        status=current_user.status,
        permissions=user_permissions(current_user),
        totp_enabled=current_user.totp_enabled,
    )


@router.get("/roles", response_model=list[UserRoleDefinitionResponse])
async def list_roles(
    _: User = Depends(require_any_platform_permission("admin.users.read", "admin.users.write")),
) -> list[UserRoleDefinitionResponse]:
    return [
        UserRoleDefinitionResponse(
            role=item.role,
            scope=item.scope,
            label=item.label,
            description=item.description,
            permissions=list(item.permissions),
        )
        for item in list_role_definitions()
    ]


@router.get("/users", response_model=list[UserSummaryResponse])
async def list_users(
    tenant_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_platform_permission("admin.users.read")),
    db: Session = Depends(get_db),
) -> list[UserSummaryResponse]:
    rows = UserService(db).list_users(tenant_id=tenant_id, limit=limit, offset=offset)
    return [_map_user_summary(user=user, tenant_name=tenant_name) for user, tenant_name in rows]


@router.post(
    "/users",
    response_model=UserCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    payload: UserCreateRequest,
    _: User = Depends(require_platform_permission("admin.users.write")),
    db: Session = Depends(get_db),
) -> UserCreateResponse:
    user_service = UserService(db)
    auth_service = AuthService(db)

    try:
        user = user_service.create_user(
            email=payload.email,
            full_name=payload.full_name,
            role=payload.role,
            tenant_id=payload.tenant_id,
            status=payload.status,
            password=payload.password,
        )
        invite_token = auth_service.create_invite(user) if payload.create_invite else None
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tenant_name = db.scalar(select(Tenant.name).where(Tenant.id == user.tenant_id)) if user.tenant_id else None
    return UserCreateResponse(
        user=_map_user_summary(user=user, tenant_name=tenant_name),
        invite_token=invite_token,
    )


@router.patch("/users/{user_id}", response_model=UserSummaryResponse)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    _: User = Depends(require_platform_permission("admin.users.write")),
    db: Session = Depends(get_db),
) -> UserSummaryResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не переданы поля для обновления пользователя.",
        )

    user_service = UserService(db)
    try:
        user = user_service.update_user(user_id, updates)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tenant_name = db.scalar(select(Tenant.name).where(Tenant.id == user.tenant_id)) if user.tenant_id else None
    return _map_user_summary(user=user, tenant_name=tenant_name)


@router.post("/tenants/{tenant_id}/approve")
async def approve_tenant(
    tenant_id: str,
    payload: TenantApprovalRequest,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    tenant_service = TenantService(db)
    notification_service = NotificationService(db)
    try:
        tenant, project, owner, generated_password, public_key, secret_key = tenant_service.approve_tenant(
            tenant_id, payload.review_comment
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_APPLICATION_APPROVED,
        subject="Заявка на подключение проекта одобрена",
        lines=[
            f"Проект: {tenant.name}",
            "Статус: одобрено администратором.",
        ],
        force_email=True,
    )
    notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_PASSWORD_GENERATED,
        subject="Сгенерирован пароль для входа в кабинет мерчанта",
        lines=[
            f"Email: {owner.email}",
            f"Временный пароль: {generated_password}",
            "Рекомендуем изменить пароль после первого входа.",
        ],
        force_email=True,
    )
    notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_API_KEY_GENERATED,
        subject="Сгенерирован API-ключ проекта",
        lines=[
            f"Project ID: {project.id}",
            f"Public key: {public_key}",
            f"Secret key: {secret_key}",
            "Сохраните secret key в защищенном месте.",
        ],
        force_email=True,
    )

    return {
        "status": tenant.status,
        "tenant_id": tenant.id,
        "project_id": project.id,
        "api_public_key": public_key,
        "api_secret_key": secret_key,
        "generated_password": generated_password,
    }


@router.post("/tenants/{tenant_id}/reject", response_model=TenantSummary)
async def reject_tenant(
    tenant_id: str,
    payload: TenantApprovalRequest,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> TenantSummary:
    tenant_service = TenantService(db)
    notification_service = NotificationService(db)
    try:
        tenant = tenant_service.reject_tenant(tenant_id, payload.review_comment)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    owner = db.scalar(
        select(User).where(User.tenant_id == tenant.id, User.role == "tenant_owner")
    )
    if owner is not None:
        review_comment = (payload.review_comment or "").strip()
        notification_lines = [f"Проект: {tenant.name}"]
        if review_comment:
            notification_lines.append(f"Комментарий: {review_comment}")
        notification_service.notify_user(
            owner,
            event_code=NotificationService.EVENT_APPLICATION_REJECTED,
            subject="Заявка на подключение проекта отклонена",
            lines=notification_lines,
        )
    return TenantSummary(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        review_comment=tenant.review_comment,
        owner_email=owner.email if owner else "",
    )


@router.post("/tenants/{tenant_id}/owner/reset-password", response_model=dict[str, str])
async def reset_tenant_owner_password(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Мерчант не найден.")

    owner = db.scalar(
        select(User).where(User.tenant_id == tenant_id, User.role == "tenant_owner")
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Владелец мерчанта не найден.",
        )

    generated_password = _generate_temporary_password()
    owner = UserService(db).update_user(
        owner.id,
        {
            "password": generated_password,
            "status": "active",
        },
    )
    NotificationService(db).notify_user(
        owner,
        event_code=NotificationService.EVENT_PASSWORD_GENERATED,
        subject="Администратор сбросил пароль от кабинета",
        lines=[
            f"Email: {owner.email}",
            f"Временный пароль: {generated_password}",
            "Рекомендуем войти и сразу сменить пароль на свой.",
        ],
        force_email=True,
    )
    return {
        "status": "ok",
        "tenant_id": tenant_id,
        "user_id": owner.id,
        "email": owner.email,
        "generated_password": generated_password,
    }


@router.post("/tenants/{tenant_id}/owner/reset-2fa", response_model=TenantOwnerSummary)
async def reset_tenant_owner_two_factor(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> TenantOwnerSummary:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Мерчант не найден.")

    owner = db.scalar(
        select(User).where(User.tenant_id == tenant_id, User.role == "tenant_owner")
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Владелец мерчанта не найден.",
        )

    owner = UserService(db).update_user(owner.id, {"reset_two_factor": True})
    NotificationService(db).notify_user(
        owner,
        event_code=NotificationService.EVENT_TWO_FACTOR_DISABLED,
        subject="2FA отключена администратором",
        lines=[
            f"Email: {owner.email}",
            "Если отключение было выполнено не по вашему запросу, срочно смените пароль.",
        ],
        force_email=True,
    )
    return TenantOwnerSummary(
        id=owner.id,
        email=owner.email,
        full_name=owner.full_name,
        status=owner.status,
    )


@router.get("/tenants/{tenant_id}/projects", response_model=list[ProjectSummary])
async def list_tenant_projects(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: Session = Depends(get_db),
) -> list[ProjectSummary]:
    project_service = ProjectService(db)
    return [
        ProjectSummary(
            id=project.id,
            tenant_id=project.tenant_id,
            name=project.name,
            domain=project.domain,
            description=project.description,
            status=project.status,
        )
        for project in project_service.list_projects_by_tenant(tenant_id)
    ]


@router.get("/tenants/{tenant_id}/api-keys", response_model=list[ApiKeySummary])
async def list_tenant_api_keys(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: Session = Depends(get_db),
) -> list[ApiKeySummary]:
    project_service = ProjectService(db)
    return [
        ApiKeySummary(
            id=api_key.id,
            project_id=api_key.project_id,
            public_key=api_key.public_key,
            status=api_key.status,
        )
        for api_key in project_service.list_api_keys_by_tenant(tenant_id)
    ]


@router.post("/api-keys/{api_key_id}/revoke", response_model=ApiKeySummary)
async def revoke_admin_api_key(
    api_key_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> ApiKeySummary:
    project_service = ProjectService(db)
    notification_service = NotificationService(db)
    api_key = project_service.get_api_key(api_key_id)
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")
    try:
        revoked = project_service.revoke_api_key(api_key_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    notification_service.notify_tenant_users(
        revoked.tenant_id,
        event_code=NotificationService.EVENT_API_KEY_REVOKED,
        subject="API-ключ отозван администратором",
        lines=[
            f"Public key: {revoked.public_key}",
            "Если отзыв был несанкционированным, срочно свяжитесь с поддержкой.",
        ],
        owner_only=True,
    )
    return ApiKeySummary(
        id=revoked.id,
        project_id=revoked.project_id,
        public_key=revoked.public_key,
        status=revoked.status,
    )


@router.post("/api-keys/{api_key_id}/regenerate", response_model=ApiKeyRegenerateResponse)
async def regenerate_admin_api_key(
    api_key_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> ApiKeyRegenerateResponse:
    project_service = ProjectService(db)
    notification_service = NotificationService(db)
    try:
        regenerated, secret_key = project_service.regenerate_api_key(api_key_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    notification_service.notify_tenant_users(
        regenerated.tenant_id,
        event_code=NotificationService.EVENT_API_KEY_REGENERATED,
        subject="API-ключ перевыпущен администратором",
        lines=[
            f"Public key: {regenerated.public_key}",
            f"Secret key: {secret_key}",
            "Сохраните новый secret key в защищенном месте.",
        ],
        owner_only=True,
        force_email=True,
    )
    return ApiKeyRegenerateResponse(
        id=regenerated.id,
        project_id=regenerated.project_id,
        public_key=regenerated.public_key,
        status=regenerated.status,
        secret_key=secret_key,
    )


@router.get("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def get_tenant_detail(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: Session = Depends(get_db),
) -> TenantDetailResponse:
    tenant_service = TenantService(db)
    project_service = ProjectService(db)
    invoice_service = InvoiceService(db)

    tenant_rows = tenant_service.list_tenants()
    row = next(((tenant, owner) for tenant, owner in tenant_rows if tenant.id == tenant_id), None)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant не найден.")

    tenant, owner = row
    projects = project_service.list_projects_by_tenant(tenant_id)
    api_keys = project_service.list_api_keys_by_tenant(tenant_id)
    invoices = invoice_service.list_invoices_by_tenant(tenant_id)

    return TenantDetailResponse(
        tenant=TenantSummary(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status,
            review_comment=tenant.review_comment,
            owner_email=owner.email,
            timezone=tenant.timezone,
            base_currency=tenant.base_currency,
            plan=tenant.plan,
        ),
        owner=TenantOwnerSummary(
            id=owner.id,
            email=owner.email,
            full_name=owner.full_name,
            status=owner.status,
        ),
        projects=[
            ProjectSummary(
                id=project.id,
                tenant_id=project.tenant_id,
                name=project.name,
                domain=project.domain,
                description=project.description,
                webhook_url=project.webhook_url,
                has_webhook_secret=ProjectService.has_webhook_secret(project),
                status=project.status,
            )
            for project in projects
        ],
        api_keys=[
            ApiKeySummary(
                id=api_key.id,
                project_id=api_key.project_id,
                public_key=api_key.public_key,
                status=api_key.status,
            )
            for api_key in api_keys
        ],
        invoices_count=len(invoices),
        approved_projects_count=len([project for project in projects if project.status == "active"]),
    )


@router.patch("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def update_tenant(
    tenant_id: str,
    payload: TenantAdminUpdateRequest,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> TenantDetailResponse:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant не найден.")

    owner = db.scalar(
        select(User)
        .where(User.tenant_id == tenant_id, User.role == "tenant_owner")
        .order_by(User.created_at.asc())
    )
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Владелец tenant не найден.")

    duplicate_tenant = db.scalar(
        select(Tenant).where(Tenant.slug == payload.slug, Tenant.id != tenant_id)
    )
    if duplicate_tenant is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug уже используется.")

    duplicate_owner = db.scalar(
        select(User).where(User.email == payload.owner_email, User.id != owner.id)
    )
    if duplicate_owner is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email владельца уже используется.")

    tenant.name = payload.company_name.strip()
    tenant.slug = payload.slug.strip()
    tenant.status = payload.status.strip()
    tenant.review_comment = (payload.review_comment or "").strip() or None
    tenant.timezone = payload.timezone.strip()
    tenant.base_currency = payload.base_currency.strip().upper()
    tenant.plan = payload.plan.strip()
    owner.email = payload.owner_email.strip()
    owner.full_name = payload.owner_full_name.strip()

    db.add_all([tenant, owner])
    db.commit()
    return await get_tenant_detail(tenant_id=tenant_id, _=_, db=db)


@router.patch("/projects/{project_id}", response_model=ProjectSummary)
async def update_admin_project(
    project_id: str,
    payload: ProjectAdminUpdateRequest,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> ProjectSummary:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден.")

    duplicate_project = db.scalar(
        select(Project).where(Project.domain == payload.domain, Project.id != project_id)
    )
    if duplicate_project is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Домен проекта уже используется.")

    project.name = payload.name.strip()
    project.domain = payload.domain.strip()
    project.description = (payload.description or "").strip() or None
    project.webhook_url = (payload.webhook_url or "").strip() or None
    project.status = payload.status.strip()
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectSummary(
        id=project.id,
        tenant_id=project.tenant_id,
        name=project.name,
        domain=project.domain,
        description=project.description,
        webhook_url=project.webhook_url,
        has_webhook_secret=ProjectService.has_webhook_secret(project),
        status=project.status,
    )


@router.delete("/tenants/{tenant_id}", response_model=dict[str, str])
async def delete_tenant(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant не найден.")

    has_history = any(
        [
            db.scalar(select(Invoice.id).where(Invoice.tenant_id == tenant_id).limit(1)),
            db.scalar(select(Project.id).where(Project.tenant_id == tenant_id, Project.status == "active").limit(1)),
            db.scalar(select(PayoutRequest.id).where(PayoutRequest.tenant_id == tenant_id).limit(1)),
            db.scalar(select(TenantBalance.id).where(TenantBalance.tenant_id == tenant_id).limit(1)),
            db.scalar(select(LedgerEntry.id).where(LedgerEntry.tenant_id == tenant_id).limit(1)),
        ]
    )
    if has_history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить мерчанта с финансовой историей. Используйте редактирование или деактивацию.",
        )

    project_ids = list(
        db.scalars(select(Project.id).where(Project.tenant_id == tenant_id)).all()
    )
    user_ids = list(
        db.scalars(select(User.id).where(User.tenant_id == tenant_id)).all()
    )
    invoice_ids = list(
        db.scalars(select(Invoice.id).where(Invoice.tenant_id == tenant_id)).all()
    )

    if invoice_ids:
        db.execute(delete(ProviderEvent).where(ProviderEvent.invoice_id.in_(invoice_ids)))
    if user_ids:
        db.execute(delete(UserSession).where(UserSession.user_id.in_(user_ids)))
        db.execute(delete(InviteToken).where(InviteToken.user_id.in_(user_ids)))
    if project_ids:
        db.execute(delete(ApiKey).where(ApiKey.project_id.in_(project_ids)))
        db.execute(delete(Project).where(Project.id.in_(project_ids)))
    if user_ids:
        db.execute(delete(User).where(User.id.in_(user_ids)))

    db.execute(delete(TenantFeePolicy).where(TenantFeePolicy.tenant_id == tenant_id))
    db.execute(delete(Tenant).where(Tenant.id == tenant_id))
    db.commit()
    return {"status": "deleted", "tenant_id": tenant_id}


@router.get("/tenants/{tenant_id}/invoices", response_model=list[InvoiceResponse])
async def list_tenant_invoices(
    tenant_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_platform_permission("admin.invoices.read")),
    db: Session = Depends(get_db),
) -> list[InvoiceResponse]:
    invoice_service = InvoiceService(db)
    invoices = invoice_service.list_invoices_by_tenant(tenant_id, limit=limit, offset=offset)
    return [_map_invoice_response(invoice) for invoice in invoices]


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_all_invoices(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_platform_permission("admin.invoices.read")),
    db: Session = Depends(get_db),
) -> list[InvoiceResponse]:
    invoice_service = InvoiceService(db)
    invoices = invoice_service.list_all_invoices(limit=limit, offset=offset)
    return [_map_invoice_response(invoice) for invoice in invoices]


@router.get("/tenants/{tenant_id}/transactions", response_model=list[TransactionResponse])
async def list_tenant_transactions(
    tenant_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_platform_permission("admin.transactions.read")),
    db: Session = Depends(get_db),
) -> list[TransactionResponse]:
    transaction_service = TransactionService(db)
    return [
        _map_transaction_response(transaction)
        for transaction in transaction_service.list_by_tenant(tenant_id, limit=limit, offset=offset)
    ]


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_all_transactions(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_platform_permission("admin.transactions.read")),
    db: Session = Depends(get_db),
) -> list[TransactionResponse]:
    transaction_service = TransactionService(db)
    return [
        _map_transaction_response(transaction)
        for transaction in transaction_service.list_all(limit=limit, offset=offset)
    ]


@router.get(
    "/tenants/{tenant_id}/accounting/summary",
    response_model=AccountingSummaryResponse,
)
async def get_tenant_accounting_summary(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.overview.read")),
    db: Session = Depends(get_db),
) -> AccountingSummaryResponse:
    accounting_service = AccountingService(db)
    return accounting_service.build_summary(tenant_id)


@router.get("/accounting/summary", response_model=AccountingSummaryResponse)
async def get_platform_accounting_summary(
    _: User = Depends(require_platform_permission("admin.overview.read")),
    db: Session = Depends(get_db),
) -> AccountingSummaryResponse:
    accounting_service = AccountingService(db)
    return accounting_service.build_summary()


@router.get("/billing/settings", response_model=PlatformBillingSettingsResponse)
async def get_platform_billing_settings(
    _: User = Depends(require_platform_permission("admin.billing.read")),
    db: Session = Depends(get_db),
) -> PlatformBillingSettingsResponse:
    platform_settings = BillingPolicyService(db).get_platform_settings()
    notification_service = NotificationService(db)
    return _map_platform_billing_settings_response(
        platform_settings=platform_settings,
        notification_service=notification_service,
    )


@router.put("/billing/settings", response_model=PlatformBillingSettingsResponse)
async def update_platform_billing_settings(
    payload: PlatformBillingSettingsUpdateRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> PlatformBillingSettingsResponse:
    billing_policy_service = BillingPolicyService(db)
    try:
        platform_settings = billing_policy_service.update_platform_settings(
            provider_fee_percent=payload.provider_fee_percent,
            default_markup_percent=payload.default_markup_percent,
            default_turnover_fee_percent=payload.default_turnover_fee_percent,
            allow_tenant_markup_override=payload.allow_tenant_markup_override,
            allow_tenant_turnover_fee_override=payload.allow_tenant_turnover_fee_override,
            payouts_enabled=payload.payouts_enabled,
            exchange_rate_markup_percent=payload.exchange_rate_markup_percent,
            manual_exchange_rates=payload.manual_exchange_rates,
            seo_title=payload.seo_title,
            seo_description=payload.seo_description,
            seo_keywords=payload.seo_keywords,
            seo_favicon_url=payload.seo_favicon_url,
            seo_og_image_url=payload.seo_og_image_url,
            seo_robots=payload.seo_robots,
            seo_canonical_url=payload.seo_canonical_url,
        )
        notification_service = NotificationService(db)
        platform_settings = notification_service.update_platform_notification_settings(
            platform_settings,
            email_notifications_enabled=payload.email_notifications_enabled,
            telegram_notifications_enabled=payload.telegram_notifications_enabled,
            event_toggles=payload.notification_events,
            smtp_bz_enabled=payload.smtp_bz_enabled,
            smtp_bz_api_base_url=payload.smtp_bz_api_base_url,
            smtp_bz_sender_email=payload.smtp_bz_sender_email,
            smtp_bz_sender_name=payload.smtp_bz_sender_name,
            smtp_bz_reply_to=payload.smtp_bz_reply_to,
            smtp_bz_tag=payload.smtp_bz_tag,
            smtp_bz_api_key=payload.smtp_bz_api_key,
            telegram_api_base_url=payload.telegram_api_base_url,
            telegram_bot_token=payload.telegram_bot_token,
            notification_brand_name=payload.notification_brand_name,
            notification_logo_url=payload.notification_logo_url,
            notification_primary_url=payload.notification_primary_url,
            notification_templates=payload.notification_templates,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _map_platform_billing_settings_response(
        platform_settings=platform_settings,
        notification_service=NotificationService(db),
    )


@router.get("/billing/exchange-rate/{currency}", response_model=ExchangeRateLookupResponse)
async def get_platform_exchange_rate(
    currency: str,
    _: User = Depends(require_platform_permission("admin.billing.read")),
    db: Session = Depends(get_db),
) -> ExchangeRateLookupResponse:
    normalized_currency = currency.strip().upper()
    manual_rates = BillingPolicyService(db).get_manual_exchange_rates()
    manual_rate = manual_rates.get(normalized_currency)
    if manual_rate is not None:
        return ExchangeRateLookupResponse(
            currency=normalized_currency,
            quote_currency="USD",
            rate=manual_rate,
            source="manual",
        )

    rate = get_exchange_rate_service().get_rate(normalized_currency, "USD")
    return ExchangeRateLookupResponse(
        currency=normalized_currency,
        quote_currency="USD",
        rate=rate,
        source="cached",
    )


@router.post(
    "/billing/exchange-rates/refresh",
    response_model=ExchangeRateRefreshResponse,
)
async def refresh_platform_exchange_rates(
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> ExchangeRateRefreshResponse:
    billing_policy_service = BillingPolicyService(db)
    rates_payload = RatesService(db).list_rates()
    symbols = sorted(
        {
            str(item.currency).strip().upper()
            for item in rates_payload.items
            if str(item.currency).strip()
        }
    )
    refreshed_rates = get_exchange_rate_service().refresh_rates_for_symbols(symbols)
    if refreshed_rates:
        cached_rates = billing_policy_service.get_cached_exchange_rates()
        cached_rates.update(refreshed_rates)
        billing_policy_service.update_cached_exchange_rates(cached_rates)
    return ExchangeRateRefreshResponse(
        quote_currency="USD",
        refreshed_symbols=len(refreshed_rates),
        cached_symbols=len(billing_policy_service.get_cached_exchange_rates()),
        refreshed=bool(refreshed_rates),
    )


@router.post("/billing/smtp/test", response_model=SmtpBzTestResponse)
async def send_platform_smtp_bz_test(
    payload: SmtpBzTestRequest,
    current_user: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> SmtpBzTestResponse:
    billing_policy_service = BillingPolicyService(db)
    notification_service = NotificationService(db)
    platform_settings = billing_policy_service.get_platform_settings()
    try:
        result = notification_service.send_smtp_bz_test_email(
            platform_settings=platform_settings,
            test_recipient_email=payload.test_recipient_email,
            smtp_bz_api_base_url=payload.smtp_bz_api_base_url,
            smtp_bz_sender_email=payload.smtp_bz_sender_email,
            smtp_bz_sender_name=payload.smtp_bz_sender_name,
            smtp_bz_reply_to=payload.smtp_bz_reply_to,
            smtp_bz_tag=payload.smtp_bz_tag,
            smtp_bz_api_key=payload.smtp_bz_api_key,
            initiated_by_email=current_user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SmtpBzTestResponse(**result)


@router.post("/billing/telegram/bot", response_model=TelegramBotIdentityResponse)
async def inspect_platform_telegram_bot(
    payload: TelegramBotInspectRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> TelegramBotIdentityResponse:
    billing_policy_service = BillingPolicyService(db)
    notification_service = NotificationService(db)
    platform_settings = billing_policy_service.get_platform_settings()
    try:
        bot_info = notification_service.inspect_telegram_bot(
            platform_settings=platform_settings,
            telegram_api_base_url=payload.telegram_api_base_url,
            telegram_bot_token=payload.telegram_bot_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TelegramBotIdentityResponse(**bot_info)


@router.post("/billing/telegram/test", response_model=TelegramAdminTestResponse)
async def send_platform_telegram_test(
    payload: TelegramAdminTestRequest,
    current_user: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> TelegramAdminTestResponse:
    billing_policy_service = BillingPolicyService(db)
    notification_service = NotificationService(db)
    platform_settings = billing_policy_service.get_platform_settings()
    try:
        result = notification_service.send_telegram_test_to_admin(
            platform_settings=platform_settings,
            admin_telegram_chat_id=payload.admin_telegram_chat_id,
            telegram_api_base_url=payload.telegram_api_base_url,
            telegram_bot_token=payload.telegram_bot_token,
            initiated_by_email=current_user.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TelegramAdminTestResponse(**result)


@router.get("/tenants/{tenant_id}/billing-policy", response_model=TenantBillingPolicyResponse)
async def get_tenant_billing_policy(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.billing.read")),
    db: Session = Depends(get_db),
) -> TenantBillingPolicyResponse:
    policy = BillingPolicyService(db).get_or_create_tenant_policy(tenant_id)
    return TenantBillingPolicyResponse(
        tenant_id=tenant_id,
        custom_markup_percent=policy.custom_markup_percent,
        custom_turnover_fee_percent=policy.custom_turnover_fee_percent,
        payouts_enabled=policy.payouts_enabled,
        requires_manual_payout_review=policy.requires_manual_payout_review,
    )


@router.put("/tenants/{tenant_id}/billing-policy", response_model=TenantBillingPolicyResponse)
async def update_tenant_billing_policy(
    tenant_id: str,
    payload: TenantBillingPolicyUpdateRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> TenantBillingPolicyResponse:
    billing_policy_service = BillingPolicyService(db)
    try:
        policy = billing_policy_service.update_tenant_policy(
            tenant_id,
            custom_markup_percent=payload.custom_markup_percent,
            custom_turnover_fee_percent=payload.custom_turnover_fee_percent,
            payouts_enabled=payload.payouts_enabled,
            requires_manual_payout_review=payload.requires_manual_payout_review,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TenantBillingPolicyResponse(
        tenant_id=tenant_id,
        custom_markup_percent=policy.custom_markup_percent,
        custom_turnover_fee_percent=policy.custom_turnover_fee_percent,
        payouts_enabled=policy.payouts_enabled,
        requires_manual_payout_review=policy.requires_manual_payout_review,
    )


@router.get("/assets", response_model=RatesResponse)
async def list_platform_assets(
    _: User = Depends(require_platform_permission("admin.assets.read")),
    db: Session = Depends(get_db),
) -> RatesResponse:
    return RatesService(db).list_rates()


@router.put("/assets", response_model=AssetAvailabilityUpdateResponse)
async def update_platform_asset_availability(
    payload: AssetAvailabilityUpdateRequest,
    _: User = Depends(require_platform_permission("admin.assets.write")),
    db: Session = Depends(get_db),
) -> AssetAvailabilityUpdateResponse:
    rates_service = RatesService(db)
    try:
        currency, network, platform_enabled = rates_service.set_platform_asset_enabled(
            currency=payload.currency,
            network=payload.network,
            platform_enabled=payload.platform_enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return AssetAvailabilityUpdateResponse(
        currency=currency,
        network=network,
        platform_enabled=platform_enabled,
    )


@router.get("/public-pages", response_model=list[PublicPageResponse])
async def list_public_pages(
    _: User = Depends(require_platform_permission("admin.billing.read")),
    db: Session = Depends(get_db),
) -> list[PublicPageResponse]:
    return [
        _map_public_page_response(item)
        for item in PublicPageService(db).list_pages()
    ]


@router.post("/public-pages", response_model=PublicPageResponse, status_code=status.HTTP_201_CREATED)
async def create_public_page(
    payload: PublicPageCreateRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> PublicPageResponse:
    service = PublicPageService(db)
    try:
        page = service.create_page(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _map_public_page_response(page)


@router.patch("/public-pages/{page_id}", response_model=PublicPageResponse)
async def update_public_page(
    page_id: str,
    payload: PublicPageUpdateRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> PublicPageResponse:
    service = PublicPageService(db)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет полей для обновления.")
    try:
        page = service.update_page(page_id=page_id, updates=updates)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _map_public_page_response(page)


@router.delete("/public-pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_public_page(
    page_id: str,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: Session = Depends(get_db),
) -> None:
    service = PublicPageService(db)
    try:
        service.delete_page(page_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_admin_transaction(
    transaction_id: str,
    _: User = Depends(require_platform_permission("admin.transactions.read")),
    db: Session = Depends(get_db),
) -> TransactionResponse:
    transaction_service = TransactionService(db)
    transaction = transaction_service.get_by_id(transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Транзакция не найдена.")
    return _map_transaction_response(transaction)


@router.get("/invoices/{invoice_id}", response_model=InvoiceAdminDetailResponse)
async def get_invoice_detail(
    invoice_id: str,
    _: User = Depends(require_platform_permission("admin.invoices.read")),
    db: Session = Depends(get_db),
) -> InvoiceAdminDetailResponse:
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice_by_id(invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Инвойс не найден.")
    return _map_invoice_admin_detail_response(invoice)


@router.post("/invoices/{invoice_id}/status", response_model=InvoiceAdminDetailResponse)
async def update_invoice_status(
    invoice_id: str,
    payload: InvoiceStatusUpdateRequest,
    _: User = Depends(require_platform_permission("admin.invoices.write")),
    db: Session = Depends(get_db),
) -> InvoiceAdminDetailResponse:
    invoice_service = InvoiceService(db)
    try:
        invoice = invoice_service.apply_invoice_status_by_id(
            invoice_id=invoice_id,
            provider_status=payload.status,
            tx_hash=payload.tx_hash,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _map_invoice_admin_detail_response(invoice)


@router.post("/invoices/{invoice_id}/sync", response_model=InvoiceAdminDetailResponse)
async def sync_invoice_status(
    invoice_id: str,
    _: User = Depends(require_platform_permission("admin.invoices.write")),
    db: Session = Depends(get_db),
) -> InvoiceAdminDetailResponse:
    from app.providers.crypto_cash import CryptoCashProviderError
    
    invoice_service = InvoiceService(db)
    invoice = invoice_service.get_invoice_by_id(invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Инвойс не найден.")
    try:
        invoice = invoice_service.sync_invoice_status(
            tenant_id=invoice.tenant_id,
            invoice_id=invoice_id,
            project_id=invoice.project_id,
        )
    except CryptoCashProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=exc.to_public_detail(),
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _map_invoice_admin_detail_response(invoice)


@router.get("/payouts", response_model=list[PayoutRequestResponse])
async def list_all_payout_requests(
    _: User = Depends(require_platform_permission("admin.payouts.read")),
    db: Session = Depends(get_db),
) -> list[PayoutRequestResponse]:
    payout_service = PayoutService(db)
    payouts = payout_service.list_all()
    tenant_names = {
        item.id: item.name
        for item in db.scalars(select(Tenant)).all()
    }
    project_names = {
        item.id: item.name
        for item in db.scalars(select(Project)).all()
    }
    return [
        _map_payout_response(
            item,
            tenant_name=tenant_names.get(item.tenant_id),
            project_name=project_names.get(item.project_id) if item.project_id else None,
        )
        for item in payouts
    ]


@router.get("/tenants/{tenant_id}/payouts", response_model=list[PayoutRequestResponse])
async def list_tenant_payout_requests(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.payouts.read")),
    db: Session = Depends(get_db),
) -> list[PayoutRequestResponse]:
    payout_service = PayoutService(db)
    payouts = payout_service.list_by_tenant(tenant_id)
    project_names = {
        item.id: item.name
        for item in db.scalars(select(Project).where(Project.tenant_id == tenant_id)).all()
    }
    tenant_name = db.scalar(select(Tenant.name).where(Tenant.id == tenant_id))
    return [
        _map_payout_response(
            item,
            tenant_name=tenant_name,
            project_name=project_names.get(item.project_id) if item.project_id else None,
        )
        for item in payouts
    ]


@router.post("/payouts/{payout_id}/review", response_model=PayoutRequestResponse)
async def review_payout_request(
    payout_id: str,
    payload: PayoutReviewRequest,
    reviewer: User = Depends(require_platform_permission("admin.payouts.write")),
    db: Session = Depends(get_db),
) -> PayoutRequestResponse:
    payout_service = PayoutService(db)
    notification_service = NotificationService(db)
    try:
        payout = payout_service.review_request(
            payout_request_id=payout_id,
            reviewer_user_id=reviewer.id,
            action=payload.action,
            review_comment=payload.review_comment,
            external_payout_id=payload.external_payout_id,
            amount_approved=payload.amount_approved,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    is_approved = payload.action == "approve"
    notification_service.notify_tenant_users(
        payout.tenant_id,
        event_code=(
            NotificationService.EVENT_PAYOUT_APPROVED
            if is_approved
            else NotificationService.EVENT_PAYOUT_REJECTED
        ),
        subject=(
            "Запрос на выплату одобрен"
            if is_approved
            else "Запрос на выплату отклонен"
        ),
        lines=[
            f"Payout ID: {payout.id}",
            f"Сумма: {payout.amount_requested} {payout.currency}",
            f"Статус: {payout.status}",
            f"Комментарий: {payload.review_comment or '-'}",
        ],
        owner_only=True,
    )
    tenant_name = db.scalar(select(Tenant.name).where(Tenant.id == payout.tenant_id))
    project_name = db.scalar(select(Project.name).where(Project.id == payout.project_id)) if payout.project_id else None
    return _map_payout_response(payout, tenant_name=tenant_name, project_name=project_name)


def _map_platform_billing_settings_response(
    *,
    platform_settings,
    notification_service: NotificationService,
    current_exchange_rates: dict[str, Decimal] | None = None,
) -> PlatformBillingSettingsResponse:
    return PlatformBillingSettingsResponse(
        provider_fee_percent=platform_settings.provider_fee_percent,
        default_markup_percent=platform_settings.default_markup_percent,
        default_turnover_fee_percent=platform_settings.default_turnover_fee_percent,
        allow_tenant_markup_override=platform_settings.allow_tenant_markup_override,
        allow_tenant_turnover_fee_override=platform_settings.allow_tenant_turnover_fee_override,
        payouts_enabled=platform_settings.payouts_enabled,
        email_notifications_enabled=platform_settings.email_notifications_enabled,
        telegram_notifications_enabled=platform_settings.telegram_notifications_enabled,
        smtp_bz_enabled=platform_settings.smtp_bz_enabled,
        smtp_bz_api_base_url=platform_settings.smtp_bz_api_base_url,
        smtp_bz_sender_email=platform_settings.smtp_bz_sender_email,
        smtp_bz_sender_name=platform_settings.smtp_bz_sender_name,
        smtp_bz_reply_to=platform_settings.smtp_bz_reply_to,
        smtp_bz_tag=platform_settings.smtp_bz_tag,
        smtp_bz_api_key_configured=notification_service.is_smtp_bz_api_key_configured(
            platform_settings
        ),
        smtp_bz_api_key_masked=notification_service.get_masked_smtp_bz_api_key(
            platform_settings
        ),
        telegram_api_base_url=platform_settings.telegram_api_base_url,
        telegram_bot_token_configured=notification_service.is_telegram_bot_token_configured(
            platform_settings
        ),
        telegram_bot_token_masked=notification_service.get_masked_telegram_bot_token(
            platform_settings
        ),
        notification_events=notification_service.get_platform_event_views(platform_settings),
        notification_brand_name=platform_settings.notification_brand_name,
        notification_logo_url=platform_settings.notification_logo_url,
        notification_primary_url=platform_settings.notification_primary_url,
        notification_templates=notification_service.get_platform_template_views(
            platform_settings
        ),
        notification_template_variables=notification_service.get_template_variables(),
        seo_title=platform_settings.seo_title,
        seo_description=platform_settings.seo_description,
        seo_keywords=platform_settings.seo_keywords,
        seo_favicon_url=platform_settings.seo_favicon_url,
        seo_og_image_url=platform_settings.seo_og_image_url,
        seo_robots=platform_settings.seo_robots,
        seo_canonical_url=platform_settings.seo_canonical_url,
        exchange_rate_markup_percent=platform_settings.exchange_rate_markup_percent,
        manual_exchange_rates=BillingPolicyService(notification_service.db).get_manual_exchange_rates(),
        current_exchange_rates=current_exchange_rates or {},
    )


def _map_user_summary(user: User, tenant_name: str | None) -> UserSummaryResponse:
    return UserSummaryResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        tenant_name=tenant_name,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        totp_enabled=user.totp_enabled,
        invited_at=user.invited_at,
        activated_at=user.activated_at,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _map_invoice_response(invoice: Invoice) -> InvoiceResponse:
    return InvoiceResponse(
        id=invoice.id,
        project_id=invoice.project_id,
        merchant_order_id=invoice.merchant_order_id,
        provider_order_id=invoice.provider_order_id,
        amount_fiat=invoice.amount_fiat,
        fiat_currency=invoice.fiat_currency,
        amount_crypto=invoice.amount_crypto,
        crypto_currency=invoice.crypto_currency,
        network=invoice.network,
        payment_address=invoice.payment_address,
        qr_url=invoice.qr_url,
        status=invoice.status,
        expires_at=invoice.expires_at,
        created_at=invoice.created_at,
    )


def _map_invoice_admin_detail_response(invoice: Invoice) -> InvoiceAdminDetailResponse:
    return InvoiceAdminDetailResponse(
        id=invoice.id,
        tenant_id=invoice.tenant_id,
        project_id=invoice.project_id,
        merchant_order_id=invoice.merchant_order_id,
        provider_order_id=invoice.provider_order_id,
        amount_fiat=invoice.amount_fiat,
        fiat_currency=invoice.fiat_currency,
        amount_crypto=invoice.amount_crypto,
        crypto_currency=invoice.crypto_currency,
        network=invoice.network,
        payment_address=invoice.payment_address,
        qr_url=invoice.qr_url,
        status=invoice.status,
        expires_at=invoice.expires_at,
        created_at=invoice.created_at,
        paid_at=invoice.paid_at,
        confirmed_at=invoice.confirmed_at,
        metadata_json=invoice.metadata_json,
        raw_provider_payload_json=invoice.raw_provider_payload_json,
    )


def _map_transaction_response(transaction) -> TransactionResponse:
    return TransactionResponse(
        id=transaction.id,
        tenant_id=transaction.tenant_id,
        project_id=transaction.project_id,
        invoice_id=transaction.invoice_id,
        gross_amount=transaction.gross_amount,
        provider_fee=transaction.provider_fee,
        platform_fee=transaction.platform_fee,
        turnover_fee=transaction.turnover_fee,
        net_amount=transaction.net_amount,
        currency=transaction.currency,
        status=transaction.status,
        paid_at=transaction.paid_at,
        created_at=transaction.created_at,
    )


def _map_payout_response(
    payout,
    *,
    tenant_name: str | None = None,
    project_name: str | None = None,
) -> PayoutRequestResponse:
    return PayoutRequestResponse(
        id=payout.id,
        tenant_id=payout.tenant_id,
        tenant_name=tenant_name,
        project_id=payout.project_id,
        project_name=project_name,
        requested_by_user_id=payout.requested_by_user_id,
        reviewed_by_user_id=payout.reviewed_by_user_id,
        destination_address=payout.destination_address,
        network=payout.network,
        currency=payout.currency,
        amount_requested=payout.amount_requested,
        amount_approved=payout.amount_approved,
        status=payout.status,
        review_comment=payout.review_comment,
        external_payout_id=payout.external_payout_id,
        processed_at=payout.processed_at,
        created_at=payout.created_at,
    )


def _map_public_page_response(page) -> PublicPageResponse:
    return PublicPageResponse(
        id=page.id,
        slug=page.slug,
        title=page.title,
        content_html=page.content_html,
        status=page.status,
        show_in_header=page.show_in_header,
        show_in_footer=page.show_in_footer,
        header_order=page.header_order,
        footer_order=page.footer_order,
        created_at=page.created_at,
        updated_at=page.updated_at,
    )


@router.get("/security/health", response_model=dict)
async def security_health_check(
    _: User = Depends(require_platform_permission("admin.security.read")),
    db: Session = Depends(get_db),
) -> dict:
    from app.core.config import settings
    from app.core.security import get_password_hash

    issues: list[dict] = []
    warnings: list[dict] = []

    if settings.is_production:
        if settings.secret_key.strip().lower() in {"", "change-me", "changeme", "secret"}:
            issues.append({"code": "insecure_secret_key", "message": "SECRET_KEY uses default value"})

        if not settings.jwt_secret_key.strip():
            issues.append({"code": "missing_jwt_secret", "message": "JWT_SECRET_KEY not configured"})

        if not settings.fernet_secret_key.strip():
            issues.append({"code": "missing_fernet_secret", "message": "FERNET_SECRET_KEY not configured"})

        if not settings.webhook_secret_key.strip():
            issues.append({"code": "missing_webhook_secret", "message": "WEBHOOK_SECRET_KEY not configured"})

        if settings.app_debug:
            issues.append({"code": "debug_enabled", "message": "APP_DEBUG is enabled in production"})

    superadmin = db.scalar(
        select(User).where(User.role == "superadmin").order_by(User.created_at.asc())
    )
    if superadmin:
        if not superadmin.totp_enabled:
            warnings.append({"code": "no_mfa_superadmin", "message": "Superadmin does not have 2FA enabled"})

        if superadmin.password_hash == get_password_hash("admin") or \
           superadmin.password_hash == get_password_hash("password") or \
           superadmin.password_hash == get_password_hash("ChangeMe123!"):
            issues.append({"code": "weak_superadmin_password", "message": "Superadmin password appears to be weak"})

    pending_tenants = list(db.scalars(
        select(Tenant).where(Tenant.status == "pending_review")
    ))
    if len(pending_tenants) > 50:
        warnings.append({"code": "many_pending_tenants", "message": f"{len(pending_tenants)} tenants pending review"})

    overall_status = "healthy" if not issues else "unhealthy"
    if not issues and warnings:
        overall_status = "warning"

    return {
        "status": overall_status,
        "issues": issues,
        "warnings": warnings,
    }


@router.get("/security/csrf", response_model=dict)
async def csrf_token_endpoint() -> dict:
    from app.middleware.csrf import generate_csrf_token
    return {"csrf_token": generate_csrf_token()}
