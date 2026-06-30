from decimal import Decimal
import logging
from secrets import choice
from string import ascii_letters, digits

from fastapi import Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_db,
    require_any_platform_permission,
    require_platform_permission,
    require_platform_user,
    require_superadmin,
    user_permissions,
)
from app.providers.crypto_cash_status import PLATFORM_INVOICE_STATUSES
from app.core.rbac import has_permission, list_role_definitions
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
from app.schemas.accounting import (
    AccountingSummaryResponse,
    PlatformAccountingOverviewResponse,
    PlatformEarningsWithdrawalCreate,
    PlatformEarningsWithdrawalView,
)
from app.schemas.assets import (
    AssetAvailabilityUpdateRequest,
    AssetAvailabilityUpdateResponse,
)
from app.schemas.billing import (
    ExchangeRateLookupResponse,
    ExchangeRateRefreshResponse,
    NotificationTemplatePreviewRequest,
    NotificationTemplatePreviewResponse,
    NotificationTemplateTestRequest,
    NotificationTemplateTestResponse,
    OpsTelegramProvisionResponse,
    OpsTelegramProvisionRequest,
    OpsTelegramSettingsView,
    OpsTelegramTopicTestRequest,
    OpsTelegramTopicTestResponse,
    OpsTelegramTopicView,
    OpsTelegramEventView,
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
from app.schemas.api_usage import ApiUsageCategoryItem, ApiUsageResponse, ApiUsageRouteItem
from app.schemas.invoice import (
    InvoiceAdminDetailResponse,
    InvoiceResponse,
    InvoiceStatusOptionResponse,
    InvoiceStatusUpdateRequest,
    InvoiceTransactionDetailsResponse,
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
from app.services.brand_logo_service import BrandLogoService
from app.services.api_usage_service import ApiUsageSummary, get_api_usage_service
from app.services.checkout_delivery_service import CheckoutDeliveryService
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.invoice_confirmations import confirmations_fields_from_stored
from app.services.payment_memo import read_stored_payment_memo
from app.services.payment_memo import read_stored_payment_memo
from app.services.invoice_service import InvoiceService
from app.services.invoice_transaction_details import build_invoice_transaction_details
from app.services.notification_service import NotificationService
from app.services.platform_ops_notify import notify_platform_ops
from app.services.platform_earnings_service import PlatformEarningsService
from app.services.platform_ops_telegram_service import PlatformOpsTelegramService

logger = logging.getLogger(__name__)
from app.services.project_service import ProjectService
from app.services.payout_service import PayoutService
from app.services.rates_service import RatesService
from app.services.payment_page_service import PaymentPageService
from app.services.public_page_service import PublicPageService
from app.services.tenant_service import TenantService
from app.services.transaction_service import TransactionService
from app.services.user_service import UserService

from fastapi import APIRouter

from app.api.routes.admin_sandbox import router as admin_sandbox_router
from app.api.routes.admin_backups import router as admin_backups_router

router = APIRouter()
router.include_router(admin_sandbox_router, prefix="/sandbox", tags=["admin-sandbox"])
router.include_router(admin_backups_router, prefix="/backups", tags=["admin-backups"])


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
    db: AsyncSession = Depends(get_db),
) -> list[TenantSummary]:
    tenant_service = TenantService(db)
    tenant_rows = await tenant_service.list_tenants(limit=limit, offset=offset)
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
    db: AsyncSession = Depends(get_db),
) -> TenantSummary:
    tenant_service = TenantService(db)
    auth_service = AuthService(db)
    notification_service = NotificationService(db)

    try:
        tenant, owner, project_id, api_public_key, api_secret_key = (
            await tenant_service.create_tenant_with_owner(payload)
        )
        invite_token = await auth_service.create_invite(owner)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось создать tenant: {exc}",
        ) from exc

    await notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_API_KEY_GENERATED,
        subject="Project created by administrator",
        lines=[
            f"Project: {tenant.name}",
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
    scope: str | None = Query(default=None, pattern="^(platform|tenant)$"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_platform_permission("admin.users.read")),
    db: AsyncSession = Depends(get_db),
) -> list[UserSummaryResponse]:
    rows = await UserService(db).list_users(
        tenant_id=tenant_id,
        scope=scope,
        limit=limit,
        offset=offset,
    )
    return [_map_user_summary(user=user, tenant_name=tenant_name) for user, tenant_name in rows]


@router.post(
    "/users",
    response_model=UserCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    payload: UserCreateRequest,
    _: User = Depends(require_platform_permission("admin.users.write")),
    db: AsyncSession = Depends(get_db),
) -> UserCreateResponse:
    user_service = UserService(db)
    auth_service = AuthService(db)

    try:
        user = await user_service.create_user(
            email=payload.email,
            full_name=payload.full_name,
            role=payload.role,
            tenant_id=payload.tenant_id,
            status=payload.status,
            password=payload.password,
        )
        invite_token = await auth_service.create_invite(user) if payload.create_invite else None
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tenant_name = await db.scalar(select(Tenant.name).where(Tenant.id == user.tenant_id)) if user.tenant_id else None
    return UserCreateResponse(
        user=_map_user_summary(user=user, tenant_name=tenant_name),
        invite_token=invite_token,
    )


@router.patch("/users/{user_id}", response_model=UserSummaryResponse)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    _: User = Depends(require_platform_permission("admin.users.write")),
    db: AsyncSession = Depends(get_db),
) -> UserSummaryResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не переданы поля для обновления пользователя.",
        )

    user_service = UserService(db)
    try:
        user = await user_service.update_user(user_id, updates)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    tenant_name = await db.scalar(select(Tenant.name).where(Tenant.id == user.tenant_id)) if user.tenant_id else None
    return _map_user_summary(user=user, tenant_name=tenant_name)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_platform_permission("admin.users.write")),
    db: AsyncSession = Depends(get_db),
) -> None:
    user_service = UserService(db)
    try:
        await user_service.delete_user(user_id, actor_id=current_user.id)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/tenants/{tenant_id}/approve")
async def approve_tenant(
    tenant_id: str,
    payload: TenantApprovalRequest,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    tenant_service = TenantService(db)
    notification_service = NotificationService(db)
    try:
        tenant, project, owner, generated_password, public_key, secret_key = await tenant_service.approve_tenant(
            tenant_id, payload.review_comment
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    await notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_APPLICATION_APPROVED,
        subject="Project registration request approved",
        lines=[
            f"Project: {tenant.name}",
            "Status: approved by administrator.",
        ],
        force_email=True,
    )
    await notify_platform_ops(
        db,
        event_code="application_approved",
        title="Мерчант одобрен",
        lines=[
            f"Проект: {tenant.name}",
            f"Tenant ID: {tenant.id}",
            f"Owner: {owner.email}",
        ],
        admin_url=f"/admin/clients/{tenant.id}",
    )
    await notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_PASSWORD_GENERATED,
        subject="Merchant cabinet sign-in password generated",
        lines=[
            f"Email: {owner.email}",
            f"Temporary password: {generated_password}",
            "We recommend changing your password after the first sign-in.",
        ],
        force_email=True,
    )
    await notification_service.notify_user(
        owner,
        event_code=NotificationService.EVENT_API_KEY_GENERATED,
        subject="Project API key generated",
        lines=[
            f"Project ID: {project.id}",
            f"Public key: {public_key}",
            f"Secret key: {secret_key}",
            "Store the secret key in a secure location.",
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
    db: AsyncSession = Depends(get_db),
) -> TenantSummary:
    tenant_service = TenantService(db)
    notification_service = NotificationService(db)
    try:
        tenant = await tenant_service.reject_tenant(tenant_id, payload.review_comment)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    owner = await db.scalar(
        select(User).where(User.tenant_id == tenant.id, User.role == "tenant_owner")
    )
    if owner is not None:
        review_comment = (payload.review_comment or "").strip()
        notification_lines = [f"Project: {tenant.name}"]
        if review_comment:
            notification_lines.append(f"Comment: {review_comment}")
        await notification_service.notify_user(
            owner,
            event_code=NotificationService.EVENT_APPLICATION_REJECTED,
            subject="Project registration request rejected",
            lines=notification_lines,
        )
    await notify_platform_ops(
        db,
        event_code="application_rejected",
        title="Заявка отклонена",
        lines=[
            f"Проект: {tenant.name}",
            f"Tenant ID: {tenant.id}",
            f"Комментарий: {(payload.review_comment or '-').strip()}",
        ],
        admin_url=f"/admin/clients/{tenant.id}",
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
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Мерчант не найден.")

    owner = await db.scalar(
        select(User).where(User.tenant_id == tenant_id, User.role == "tenant_owner")
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Владелец мерчанта не найден.",
        )

    generated_password = _generate_temporary_password()
    owner = await UserService(db).update_user(
        owner.id,
        {
            "password": generated_password,
            "status": "active",
        },
    )
    await NotificationService(db).notify_user(
        owner,
        event_code=NotificationService.EVENT_PASSWORD_GENERATED,
        subject="Cabinet password reset by administrator",
        lines=[
            f"Email: {owner.email}",
            f"Temporary password: {generated_password}",
            "Sign in and change your password as soon as possible.",
        ],
        force_email=True,
    )
    tenant_name = await db.scalar(select(Tenant.name).where(Tenant.id == tenant_id))
    await notify_platform_ops(
        db,
        event_code="tenant_password_reset",
        title="Сброс пароля мерчанта",
        lines=[
            f"Мерчант: {tenant_name or tenant_id}",
            f"Owner: {owner.email}",
        ],
        admin_url=f"/admin/clients/{tenant_id}",
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
    db: AsyncSession = Depends(get_db),
) -> TenantOwnerSummary:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Мерчант не найден.")

    owner = await db.scalar(
        select(User).where(User.tenant_id == tenant_id, User.role == "tenant_owner")
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Владелец мерчанта не найден.",
        )

    owner = await UserService(db).update_user(owner.id, {"reset_two_factor": True})
    await NotificationService(db).notify_user(
        owner,
        event_code=NotificationService.EVENT_TWO_FACTOR_DISABLED,
        subject="2FA disabled by administrator",
        lines=[
            f"Email: {owner.email}",
            "If this was not requested by you, change your password immediately.",
        ],
        force_email=True,
    )
    await notify_platform_ops(
        db,
        event_code="tenant_2fa_reset",
        title="2FA мерчанта сброшена админом",
        lines=[
            f"Мерчант: {tenant.name}",
            f"Owner: {owner.email}",
        ],
        admin_url=f"/admin/clients/{tenant_id}",
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
    db: AsyncSession = Depends(get_db),
) -> list[ProjectSummary]:
    project_service = ProjectService(db)
    return [
        ProjectSummary(
            id=project.id,
            tenant_id=project.tenant_id,
            name=project.name,
            domain=project.domain,
            description=project.description,
            webhook_url=project.webhook_url,
            has_webhook_secret=ProjectService.has_webhook_secret(project),
            checkout_delivery=CheckoutDeliveryService.normalize(project.checkout_delivery),
            status=project.status,
        )
        for project in await project_service.list_projects_by_tenant(tenant_id)
    ]


@router.get("/tenants/{tenant_id}/api-keys", response_model=list[ApiKeySummary])
async def list_tenant_api_keys(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: AsyncSession = Depends(get_db),
) -> list[ApiKeySummary]:
    project_service = ProjectService(db)
    return [
        ApiKeySummary(
            id=api_key.id,
            project_id=api_key.project_id,
            public_key=api_key.public_key,
            status=api_key.status,
        )
        for api_key in await project_service.list_api_keys_by_tenant(tenant_id)
    ]


@router.post("/api-keys/{api_key_id}/revoke", response_model=ApiKeySummary)
async def revoke_admin_api_key(
    api_key_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: AsyncSession = Depends(get_db),
) -> ApiKeySummary:
    project_service = ProjectService(db)
    notification_service = NotificationService(db)
    api_key = await project_service.get_api_key(api_key_id)
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")
    try:
        revoked = await project_service.revoke_api_key(api_key_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await notification_service.notify_tenant_users(
        revoked.tenant_id,
        event_code=NotificationService.EVENT_API_KEY_REVOKED,
        subject="API key revoked by administrator",
        lines=[
            f"Public key: {revoked.public_key}",
            "If this revocation was unauthorized, contact support immediately.",
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
    db: AsyncSession = Depends(get_db),
) -> ApiKeyRegenerateResponse:
    project_service = ProjectService(db)
    notification_service = NotificationService(db)
    try:
        regenerated, secret_key = await project_service.regenerate_api_key(api_key_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await notification_service.notify_tenant_users(
        regenerated.tenant_id,
        event_code=NotificationService.EVENT_API_KEY_REGENERATED,
        subject="API key regenerated by administrator",
        lines=[
            f"Public key: {regenerated.public_key}",
            f"Secret key: {secret_key}",
            "Store the new secret key in a secure location.",
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
    db: AsyncSession = Depends(get_db),
) -> TenantDetailResponse:
    tenant_service = TenantService(db)
    project_service = ProjectService(db)
    invoice_service = InvoiceService(db)

    tenant_rows = await tenant_service.list_tenants()
    row = next(((tenant, owner) for tenant, owner in tenant_rows if tenant.id == tenant_id), None)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant не найден.")

    tenant, owner = row
    projects = await project_service.list_projects_by_tenant(tenant_id)
    api_keys = await project_service.list_api_keys_by_tenant(tenant_id)
    invoices = await invoice_service.list_invoices_by_tenant(tenant_id)

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
                checkout_delivery=CheckoutDeliveryService.normalize(project.checkout_delivery),
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
    db: AsyncSession = Depends(get_db),
) -> TenantDetailResponse:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant не найден.")

    owner = await db.scalar(
        select(User)
        .where(User.tenant_id == tenant_id, User.role == "tenant_owner")
        .order_by(User.created_at.asc())
    )
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Владелец tenant не найден.")

    duplicate_tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == payload.slug, Tenant.id != tenant_id)
    )
    if duplicate_tenant is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug уже используется.")

    duplicate_owner = await db.scalar(
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
    await db.commit()
    return await get_tenant_detail(tenant_id=tenant_id, _=_, db=db)


@router.patch("/projects/{project_id}", response_model=ProjectSummary)
async def update_admin_project(
    project_id: str,
    payload: ProjectAdminUpdateRequest,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: AsyncSession = Depends(get_db),
) -> ProjectSummary:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден.")

    duplicate_project = await db.scalar(
        select(Project).where(Project.domain == payload.domain, Project.id != project_id)
    )
    if duplicate_project is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Домен проекта уже используется.")

    project.name = payload.name.strip()
    project.domain = payload.domain.strip()
    project.description = (payload.description or "").strip() or None
    project.webhook_url = (payload.webhook_url or "").strip() or None
    project.checkout_delivery = CheckoutDeliveryService.normalize(payload.checkout_delivery)
    project.status = payload.status.strip()
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectSummary(
        id=project.id,
        tenant_id=project.tenant_id,
        name=project.name,
        domain=project.domain,
        description=project.description,
        webhook_url=project.webhook_url,
        has_webhook_secret=ProjectService.has_webhook_secret(project),
        checkout_delivery=CheckoutDeliveryService.normalize(project.checkout_delivery),
        status=project.status,
    )


def _map_api_usage(summary: ApiUsageSummary) -> ApiUsageResponse:
    return ApiUsageResponse(
        scope_type=summary.scope_type,
        scope_id=summary.scope_id,
        period_days=summary.period_days,
        period_start=summary.period_start,
        period_end=summary.period_end,
        total_requests=summary.total_requests,
        total_errors=summary.total_errors,
        categories=[
            ApiUsageCategoryItem(
                category=category.category,
                label=category.label,
                total=category.total,
                errors=category.errors,
                routes=[
                    ApiUsageRouteItem(
                        route_key=route.route_key,
                        label=route.label,
                        total=route.total,
                        errors=route.errors,
                    )
                    for route in category.routes
                ],
            )
            for category in summary.categories
        ],
    )


@router.get("/api-usage", response_model=ApiUsageResponse)
async def get_platform_api_usage(
    days: int = Query(default=30, ge=1, le=45),
    _: User = Depends(require_platform_permission("admin.events.read")),
) -> ApiUsageResponse:
    summary = get_api_usage_service().get_platform_usage(days=days)
    return _map_api_usage(summary)


@router.get("/projects/{project_id}/api-usage", response_model=ApiUsageResponse)
async def get_project_api_usage(
    project_id: str,
    days: int = Query(default=30, ge=1, le=45),
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: AsyncSession = Depends(get_db),
) -> ApiUsageResponse:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден.")
    summary = get_api_usage_service().get_project_usage(project_id, days=days)
    return _map_api_usage(summary)


@router.get("/tenants/{tenant_id}/api-usage", response_model=ApiUsageResponse)
async def get_tenant_api_usage(
    tenant_id: str,
    days: int = Query(default=30, ge=1, le=45),
    _: User = Depends(require_platform_permission("admin.tenants.read")),
    db: AsyncSession = Depends(get_db),
) -> ApiUsageResponse:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant не найден.")
    summary = get_api_usage_service().get_tenant_usage(tenant_id, days=days)
    return _map_api_usage(summary)


@router.delete("/tenants/{tenant_id}", response_model=dict[str, str])
async def delete_tenant(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.tenants.write")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant не найден.")

    has_history = any(
        [
            await db.scalar(select(Invoice.id).where(Invoice.tenant_id == tenant_id).limit(1)),
            await db.scalar(select(Project.id).where(Project.tenant_id == tenant_id, Project.status == "active").limit(1)),
            await db.scalar(select(PayoutRequest.id).where(PayoutRequest.tenant_id == tenant_id).limit(1)),
            await db.scalar(select(TenantBalance.id).where(TenantBalance.tenant_id == tenant_id).limit(1)),
            await db.scalar(select(LedgerEntry.id).where(LedgerEntry.tenant_id == tenant_id).limit(1)),
        ]
    )
    if has_history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить мерчанта с финансовой историей. Используйте редактирование или деактивацию.",
        )

    project_ids = list(
        (await db.scalars(select(Project.id).where(Project.tenant_id == tenant_id))).all()
    )
    user_ids = list(
        (await db.scalars(select(User.id).where(User.tenant_id == tenant_id))).all()
    )
    invoice_ids = list(
        (await db.scalars(select(Invoice.id).where(Invoice.tenant_id == tenant_id))).all()
    )

    if invoice_ids:
        await db.execute(delete(ProviderEvent).where(ProviderEvent.invoice_id.in_(invoice_ids)))
    if user_ids:
        await db.execute(delete(UserSession).where(UserSession.user_id.in_(user_ids)))
        await db.execute(delete(InviteToken).where(InviteToken.user_id.in_(user_ids)))
    if project_ids:
        await db.execute(delete(ApiKey).where(ApiKey.project_id.in_(project_ids)))
        await db.execute(delete(Project).where(Project.id.in_(project_ids)))
    if user_ids:
        await db.execute(delete(User).where(User.id.in_(user_ids)))

    await db.execute(delete(TenantFeePolicy).where(TenantFeePolicy.tenant_id == tenant_id))
    await db.execute(delete(Tenant).where(Tenant.id == tenant_id))
    await db.commit()
    return {"status": "deleted", "tenant_id": tenant_id}


async def _maybe_sync_admin_invoice(
    invoice_service: InvoiceService,
    invoice: Invoice,
) -> Invoice:
    from app.providers.crypto_cash import CryptoCashProviderError

    try:
        return await invoice_service.sync_invoice_status(
            tenant_id=invoice.tenant_id,
            invoice_id=str(invoice.id),
            project_id=invoice.project_id,
        )
    except CryptoCashProviderError:
        raise
    except ValueError:
        raise
    except Exception:
        logger.exception("Admin invoice sync failed for invoice_id=%s", invoice.id)
        refreshed = await invoice_service.get_invoice_by_id(str(invoice.id))
        if refreshed is not None:
            transaction = await TransactionService(invoice_service.db).get_latest_for_invoice(refreshed.id)
            if transaction is not None:
                await invoice_service.reconcile_transaction_with_invoice(refreshed, transaction)
                await invoice_service.db.commit()
                refreshed = await invoice_service.get_invoice_by_id(str(invoice.id)) or refreshed
        return refreshed if refreshed is not None else invoice


async def _reconcile_admin_invoice_transaction(
    db: AsyncSession,
    invoice_service: InvoiceService,
    invoice: Invoice,
) -> Invoice:
    transaction = await TransactionService(db).get_latest_for_invoice(invoice.id)
    if transaction is None:
        return invoice
    if await invoice_service.reconcile_transaction_with_invoice(invoice, transaction):
        await db.commit()
        refreshed = await invoice_service.get_invoice_by_id(str(invoice.id))
        return refreshed if refreshed is not None else invoice
    return invoice


async def _sync_active_admin_invoices(
    invoice_service: InvoiceService,
    invoices: list[Invoice],
    *,
    db: AsyncSession,
) -> list[Invoice]:
    synced: list[Invoice] = []
    for invoice in invoices:
        if invoice.status in {"pending", "confirming", "cancelled"}:
            try:
                invoice = await _maybe_sync_admin_invoice(invoice_service, invoice)
            except (CryptoCashProviderError, ValueError):
                pass
        invoice = await _reconcile_admin_invoice_transaction(db, invoice_service, invoice)
        synced.append(invoice)
    return synced


async def _invoices_by_transaction_rows(
    db: AsyncSession,
    transactions: list,
) -> dict[str, Invoice]:
    if not transactions:
        return {}
    invoice_ids = {transaction.invoice_id for transaction in transactions}
    rows = await db.scalars(select(Invoice).where(Invoice.id.in_(invoice_ids)))
    return {invoice.id: invoice for invoice in rows}


async def _get_admin_invoice_detail(
    db: AsyncSession,
    invoice_id: str,
    *,
    sync: bool,
) -> InvoiceAdminDetailResponse:
    from app.providers.crypto_cash import CryptoCashProviderError

    invoice_service = InvoiceService(db)
    invoice = await invoice_service.get_invoice_by_id(invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Инвойс не найден.")
    if sync:
        try:
            invoice = await _maybe_sync_admin_invoice(invoice_service, invoice)
        except CryptoCashProviderError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=exc.to_public_detail(),
            ) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    invoice = await _reconcile_admin_invoice_transaction(db, invoice_service, invoice)
    return await _map_invoice_admin_detail_response(db, invoice)


@router.get("/tenants/{tenant_id}/invoices", response_model=list[InvoiceResponse])
async def list_tenant_invoices(
    tenant_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    sync: bool = Query(default=False, description="Синхронизировать активные инвойсы с провайдером"),
    current_user: User = Depends(require_platform_permission("admin.invoices.read")),
    db: AsyncSession = Depends(get_db),
) -> list[InvoiceResponse]:
    if sync and not has_permission(current_user.role, "admin.invoices.write"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: admin.invoices.write.",
        )
    invoice_service = InvoiceService(db)
    invoices = await invoice_service.list_invoices_by_tenant(tenant_id, limit=limit, offset=offset)
    if sync:
        invoices = await _sync_active_admin_invoices(invoice_service, invoices, db=db)
    return [_map_invoice_response(invoice) for invoice in invoices]


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_all_invoices(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    sync: bool = Query(default=False, description="Синхронизировать активные инвойсы с провайдером"),
    current_user: User = Depends(require_platform_permission("admin.invoices.read")),
    db: AsyncSession = Depends(get_db),
) -> list[InvoiceResponse]:
    if sync and not has_permission(current_user.role, "admin.invoices.write"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: admin.invoices.write.",
        )
    invoice_service = InvoiceService(db)
    invoices = await invoice_service.list_all_invoices(limit=limit, offset=offset)
    if sync:
        invoices = await _sync_active_admin_invoices(invoice_service, invoices, db=db)
    return [_map_invoice_response(invoice) for invoice in invoices]


@router.get("/tenants/{tenant_id}/transactions", response_model=list[TransactionResponse])
async def list_tenant_transactions(
    tenant_id: str,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    reconcile: bool = Query(default=False, description="Сверить транзакции с инвойсами"),
    current_user: User = Depends(require_platform_permission("admin.transactions.read")),
    db: AsyncSession = Depends(get_db),
) -> list[TransactionResponse]:
    if reconcile and not has_permission(current_user.role, "admin.invoices.write"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: admin.invoices.write.",
        )
    transaction_service = TransactionService(db)
    transactions = list(
        await transaction_service.list_by_tenant(tenant_id, limit=limit, offset=offset)
    )
    invoices_by_id = await _invoices_by_transaction_rows(db, transactions)
    if reconcile:
        invoice_service = InvoiceService(db)
        changed = False
        for transaction in transactions:
            invoice = invoices_by_id.get(transaction.invoice_id)
            if invoice is None:
                continue
            if await invoice_service.reconcile_transaction_with_invoice(invoice, transaction):
                changed = True
        if changed:
            await db.commit()
            transactions = list(
                await transaction_service.list_by_tenant(tenant_id, limit=limit, offset=offset)
            )
            invoices_by_id = await _invoices_by_transaction_rows(db, transactions)
    return [
        _map_transaction_response(transaction, invoices_by_id.get(transaction.invoice_id))
        for transaction in transactions
    ]


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_all_transactions(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    reconcile: bool = Query(default=False, description="Сверить транзакции с инвойсами"),
    current_user: User = Depends(require_platform_permission("admin.transactions.read")),
    db: AsyncSession = Depends(get_db),
) -> list[TransactionResponse]:
    if reconcile and not has_permission(current_user.role, "admin.invoices.write"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: admin.invoices.write.",
        )
    transaction_service = TransactionService(db)
    transactions = list(await transaction_service.list_all(limit=limit, offset=offset))
    invoices_by_id = await _invoices_by_transaction_rows(db, transactions)
    if reconcile:
        invoice_service = InvoiceService(db)
        changed = False
        for transaction in transactions:
            invoice = invoices_by_id.get(transaction.invoice_id)
            if invoice is None:
                continue
            if await invoice_service.reconcile_transaction_with_invoice(invoice, transaction):
                changed = True
        if changed:
            await db.commit()
            transactions = list(await transaction_service.list_all(limit=limit, offset=offset))
            invoices_by_id = await _invoices_by_transaction_rows(db, transactions)
    return [
        _map_transaction_response(transaction, invoices_by_id.get(transaction.invoice_id))
        for transaction in transactions
    ]


@router.get(
    "/tenants/{tenant_id}/accounting/summary",
    response_model=AccountingSummaryResponse,
)
async def get_tenant_accounting_summary(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.overview.read")),
    db: AsyncSession = Depends(get_db),
) -> AccountingSummaryResponse:
    accounting_service = AccountingService(db)
    return await accounting_service.build_summary(tenant_id)


@router.get("/accounting/summary", response_model=AccountingSummaryResponse)
async def get_platform_accounting_summary(
    _: User = Depends(require_platform_permission("admin.overview.read")),
    db: AsyncSession = Depends(get_db),
) -> AccountingSummaryResponse:
    accounting_service = AccountingService(db)
    return await accounting_service.build_summary()


@router.get("/accounting/overview", response_model=PlatformAccountingOverviewResponse)
async def get_platform_accounting_overview(
    _: User = Depends(require_platform_permission("admin.overview.read")),
    db: AsyncSession = Depends(get_db),
) -> PlatformAccountingOverviewResponse:
    accounting_service = AccountingService(db)
    return await accounting_service.build_platform_overview()


@router.post(
    "/accounting/platform-withdrawals",
    response_model=PlatformEarningsWithdrawalView,
    status_code=status.HTTP_201_CREATED,
)
async def record_platform_earnings_withdrawal(
    payload: PlatformEarningsWithdrawalCreate,
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> PlatformEarningsWithdrawalView:
    service = PlatformEarningsService(db)
    try:
        entry = await service.record_withdrawal(
            amount=payload.amount,
            recorded_by_user_id=current_user.id,
            note=payload.note,
            external_reference=payload.external_reference,
            withdrawn_at=payload.withdrawn_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PlatformEarningsWithdrawalView(
        id=str(entry.id),
        amount=entry.amount,
        currency=entry.currency,
        note=entry.note,
        external_reference=entry.external_reference,
        recorded_by_email=current_user.email,
        withdrawn_at=entry.withdrawn_at,
        created_at=entry.created_at,
    )


@router.get("/billing/settings", response_model=PlatformBillingSettingsResponse)
async def get_platform_billing_settings(
    current_user: User = Depends(require_platform_permission("admin.billing.read")),
    db: AsyncSession = Depends(get_db),
) -> PlatformBillingSettingsResponse:
    platform_settings = await BillingPolicyService(db).get_platform_settings()
    notification_service = NotificationService(db)
    return await _map_platform_billing_settings_response(
        platform_settings=platform_settings,
        notification_service=notification_service,
        include_ops_telegram=current_user.role == "superadmin",
    )


@router.put("/billing/settings", response_model=PlatformBillingSettingsResponse)
async def update_platform_billing_settings(
    payload: PlatformBillingSettingsUpdateRequest,
    current_user: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> PlatformBillingSettingsResponse:
    billing_policy_service = BillingPolicyService(db)
    try:
        platform_settings = await billing_policy_service.update_platform_settings(
            provider_fee_percent=payload.provider_fee_percent,
            default_markup_percent=payload.default_markup_percent,
            platform_markup_min_usdt=payload.platform_markup_min_usdt,
            platform_fee_min_usdt=payload.platform_fee_min_usdt,
            allow_tenant_markup_override=payload.allow_tenant_markup_override,
            payouts_enabled=payload.payouts_enabled,
            exchange_rate_markup_percent=payload.exchange_rate_markup_percent,
            exchange_rate_price_field=payload.exchange_rate_price_field,
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
        platform_settings = await notification_service.update_platform_notification_settings(
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
        if current_user.role == "superadmin" and payload.ops_telegram is not None:
            ops_payload = payload.ops_telegram
            existing_chat_id = (platform_settings.ops_telegram_chat_id or "").strip()
            incoming_chat_id = (ops_payload.chat_id or "").strip()
            incoming_wipe = (
                not ops_payload.enabled
                and not incoming_chat_id
                and not ops_payload.topics
            )
            if existing_chat_id and incoming_wipe:
                logger.info(
                    "Skipping ops_telegram wipe on billing settings update "
                    "(chat_id=%s preserved)",
                    existing_chat_id,
                )
            else:
                ops_service = PlatformOpsTelegramService(db)
                platform_settings = await ops_service.update_settings(
                    platform_settings,
                    enabled=ops_payload.enabled,
                    chat_id=ops_payload.chat_id,
                    topics=ops_payload.topics,
                    event_toggles=ops_payload.events,
                )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return await _map_platform_billing_settings_response(
        platform_settings=platform_settings,
        notification_service=NotificationService(db),
        include_ops_telegram=current_user.role == "superadmin",
    )


@router.post("/billing/settings/brand-logo", response_model=PlatformBillingSettingsResponse)
async def upload_platform_brand_logo(
    file: UploadFile = File(...),
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> PlatformBillingSettingsResponse:
    service = BrandLogoService(db)
    try:
        platform_settings, _public_url = await service.upload_logo(file)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return await _map_platform_billing_settings_response(
        platform_settings=platform_settings,
        notification_service=NotificationService(db),
        include_ops_telegram=False,
    )


@router.delete("/billing/settings/brand-logo", response_model=PlatformBillingSettingsResponse)
async def delete_platform_brand_logo(
    current_user: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> PlatformBillingSettingsResponse:
    platform_settings = await BrandLogoService(db).remove_uploaded_logo()
    return await _map_platform_billing_settings_response(
        platform_settings=platform_settings,
        notification_service=NotificationService(db),
        include_ops_telegram=current_user.role == "superadmin",
    )


@router.post(
    "/billing/notifications/preview",
    response_model=NotificationTemplatePreviewResponse,
)
async def preview_platform_notification_template(
    payload: NotificationTemplatePreviewRequest,
    _: User = Depends(require_platform_permission("admin.billing.read")),
    db: AsyncSession = Depends(get_db),
) -> NotificationTemplatePreviewResponse:
    platform_settings = await BillingPolicyService(db).get_platform_settings()
    notification_service = NotificationService(db)
    try:
        rendered = notification_service.preview_notification_template(
            platform_settings=platform_settings,
            event_code=payload.code,
            email_subject=payload.email_subject,
            message_lines=payload.message_lines,
            email_body=payload.email_body,
            telegram_body=payload.telegram_body,
            sample_context=payload.sample_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return NotificationTemplatePreviewResponse(**rendered)


@router.post(
    "/billing/notifications/test",
    response_model=NotificationTemplateTestResponse,
)
async def send_platform_notification_template_test(
    payload: NotificationTemplateTestRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> NotificationTemplateTestResponse:
    platform_settings = await BillingPolicyService(db).get_platform_settings()
    notification_service = NotificationService(db)
    try:
        rendered = notification_service.send_notification_template_test(
            platform_settings=platform_settings,
            event_code=payload.code,
            email_subject=payload.email_subject,
            message_lines=payload.message_lines,
            email_body=payload.email_body,
            telegram_body=payload.telegram_body,
            sample_context=payload.sample_context,
            test_recipient_email=payload.test_recipient_email,
            telegram_chat_id=payload.telegram_chat_id,
            smtp_bz_api_key=payload.smtp_bz_api_key,
            telegram_bot_token=payload.telegram_bot_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return NotificationTemplateTestResponse(**rendered)


@router.get("/billing/exchange-rate/{currency}", response_model=ExchangeRateLookupResponse)
async def get_platform_exchange_rate(
    currency: str,
    _: User = Depends(require_platform_permission("admin.billing.read")),
    db: AsyncSession = Depends(get_db),
) -> ExchangeRateLookupResponse:
    normalized_currency = currency.strip().upper()
    billing_policy_service = BillingPolicyService(db)
    manual_rates = await billing_policy_service.get_manual_exchange_rates()
    manual_rate = manual_rates.get(normalized_currency)
    if manual_rate is not None:
        return ExchangeRateLookupResponse(
            currency=normalized_currency,
            quote_currency="USD",
            rate=manual_rate,
            source="manual",
        )

    price_field = await billing_policy_service.get_exchange_rate_price_field()
    rate = await get_exchange_rate_service().get_rate(normalized_currency, "USD")
    return ExchangeRateLookupResponse(
        currency=normalized_currency,
        quote_currency="USD",
        rate=rate,
        source=f"crypto_cash_{price_field}",
    )


@router.post(
    "/billing/exchange-rates/refresh",
    response_model=ExchangeRateRefreshResponse,
)
async def refresh_platform_exchange_rates(
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> ExchangeRateRefreshResponse:
    billing_policy_service = BillingPolicyService(db)
    rates_payload = await RatesService(db).list_rates()
    symbols = sorted(
        {
            str(item.currency).strip().upper()
            for item in rates_payload.items
            if str(item.currency).strip()
        }
    )
    refreshed_rates = get_exchange_rate_service().refresh_rates_for_symbols(symbols)
    if refreshed_rates:
        cached_rates = await billing_policy_service.get_cached_exchange_rates()
        cached_rates.update(refreshed_rates)
        await billing_policy_service.update_cached_exchange_rates(cached_rates)
    return ExchangeRateRefreshResponse(
        quote_currency="USD",
        refreshed_symbols=len(refreshed_rates),
        cached_symbols=len(await billing_policy_service.get_cached_exchange_rates()),
        refreshed=bool(refreshed_rates),
    )


@router.post("/billing/smtp/test", response_model=SmtpBzTestResponse)
async def send_platform_smtp_bz_test(
    payload: SmtpBzTestRequest,
    current_user: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> SmtpBzTestResponse:
    billing_policy_service = BillingPolicyService(db)
    notification_service = NotificationService(db)
    platform_settings = await billing_policy_service.get_platform_settings()
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
    db: AsyncSession = Depends(get_db),
) -> TelegramBotIdentityResponse:
    billing_policy_service = BillingPolicyService(db)
    notification_service = NotificationService(db)
    platform_settings = await billing_policy_service.get_platform_settings()
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
    db: AsyncSession = Depends(get_db),
) -> TelegramAdminTestResponse:
    billing_policy_service = BillingPolicyService(db)
    notification_service = NotificationService(db)
    platform_settings = await billing_policy_service.get_platform_settings()
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


@router.post("/billing/ops-telegram/provision", response_model=OpsTelegramProvisionResponse)
async def provision_ops_telegram_topics(
    payload: OpsTelegramProvisionRequest = OpsTelegramProvisionRequest(),
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> OpsTelegramProvisionResponse:
    ops_service = PlatformOpsTelegramService(db)
    try:
        result = await ops_service.provision_forum_topics(
            initiated_by_email=current_user.email,
            chat_id_override=payload.chat_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return OpsTelegramProvisionResponse(**result)


@router.post("/billing/ops-telegram/test", response_model=OpsTelegramTopicTestResponse)
async def send_ops_telegram_topic_test(
    payload: OpsTelegramTopicTestRequest,
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> OpsTelegramTopicTestResponse:
    ops_service = PlatformOpsTelegramService(db)
    try:
        result = await ops_service.send_test_message(
            topic_key=payload.topic_key,
            initiated_by_email=current_user.email,
            chat_id_override=payload.chat_id,
            thread_id_override=payload.thread_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return OpsTelegramTopicTestResponse(**result)


@router.get("/tenants/{tenant_id}/billing-policy", response_model=TenantBillingPolicyResponse)
async def get_tenant_billing_policy(
    tenant_id: str,
    _: User = Depends(require_platform_permission("admin.billing.read")),
    db: AsyncSession = Depends(get_db),
) -> TenantBillingPolicyResponse:
    policy = await BillingPolicyService(db).get_or_create_tenant_policy(tenant_id)
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
    db: AsyncSession = Depends(get_db),
) -> TenantBillingPolicyResponse:
    billing_policy_service = BillingPolicyService(db)
    try:
        policy = await billing_policy_service.update_tenant_policy(
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
    db: AsyncSession = Depends(get_db),
) -> RatesResponse:
    from app.providers.crypto_cash import CryptoCashProviderError

    try:
        return await RatesService(db).list_rates()
    except CryptoCashProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=exc.to_public_detail(),
        ) from exc


@router.put("/assets", response_model=AssetAvailabilityUpdateResponse)
async def update_platform_asset_availability(
    payload: AssetAvailabilityUpdateRequest,
    _: User = Depends(require_platform_permission("admin.assets.write")),
    db: AsyncSession = Depends(get_db),
) -> AssetAvailabilityUpdateResponse:
    rates_service = RatesService(db)
    try:
        currency, network, platform_enabled = await rates_service.set_platform_asset_enabled(
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
    db: AsyncSession = Depends(get_db),
) -> list[PublicPageResponse]:
    return [
        _map_public_page_response(item)
        for item in await PublicPageService(db).list_pages()
    ]


@router.post("/public-pages", response_model=PublicPageResponse, status_code=status.HTTP_201_CREATED)
async def create_public_page(
    payload: PublicPageCreateRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> PublicPageResponse:
    service = PublicPageService(db)
    try:
        page = await service.create_page(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _map_public_page_response(page)


@router.patch("/public-pages/{page_id}", response_model=PublicPageResponse)
async def update_public_page(
    page_id: str,
    payload: PublicPageUpdateRequest,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> PublicPageResponse:
    service = PublicPageService(db)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет полей для обновления.")
    try:
        page = await service.update_page(page_id=page_id, updates=updates)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _map_public_page_response(page)


@router.delete("/public-pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_public_page(
    page_id: str,
    _: User = Depends(require_platform_permission("admin.billing.write")),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = PublicPageService(db)
    try:
        await service.delete_page(page_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_admin_transaction(
    transaction_id: str,
    _: User = Depends(require_platform_permission("admin.transactions.read")),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction_service = TransactionService(db)
    transaction = await transaction_service.get_by_id(transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Транзакция не найдена.")
    invoice = await db.get(Invoice, transaction.invoice_id)
    return _map_transaction_response(transaction, invoice)


@router.get("/invoice-statuses", response_model=list[InvoiceStatusOptionResponse])
async def list_invoice_statuses(
    _: User = Depends(require_platform_permission("admin.invoices.read")),
) -> list[InvoiceStatusOptionResponse]:
    return [InvoiceStatusOptionResponse(value=item) for item in PLATFORM_INVOICE_STATUSES]


@router.post("/transactions/{transaction_id}/status", response_model=TransactionResponse)
async def update_transaction_status(
    transaction_id: str,
    payload: InvoiceStatusUpdateRequest,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction_service = TransactionService(db)
    transaction = await transaction_service.get_by_id(transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Транзакция не найдена.")
    invoice_service = InvoiceService(db)
    try:
        invoice = await invoice_service.apply_invoice_status_by_id(
            invoice_id=str(transaction.invoice_id),
            provider_status=payload.status,
            tx_hash=payload.tx_hash,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    refreshed = await transaction_service.get_by_id(transaction_id)
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Транзакция не найдена.")
    return _map_transaction_response(refreshed, invoice)


@router.get("/invoices/{invoice_id}", response_model=InvoiceAdminDetailResponse)
async def get_invoice_detail(
    invoice_id: str,
    sync: bool = Query(default=False, description="Синхронизировать статус с провайдером"),
    current_user: User = Depends(require_platform_permission("admin.invoices.read")),
    db: AsyncSession = Depends(get_db),
) -> InvoiceAdminDetailResponse:
    if sync and not has_permission(current_user.role, "admin.invoices.write"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: admin.invoices.write.",
        )
    return await _get_admin_invoice_detail(db, invoice_id, sync=sync)


@router.post("/invoices/{invoice_id}/status", response_model=InvoiceAdminDetailResponse)
async def update_invoice_status(
    invoice_id: str,
    payload: InvoiceStatusUpdateRequest,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> InvoiceAdminDetailResponse:
    invoice_service = InvoiceService(db)
    try:
        invoice = await invoice_service.apply_invoice_status_by_id(
            invoice_id=invoice_id,
            provider_status=payload.status,
            tx_hash=payload.tx_hash,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return await _map_invoice_admin_detail_response(db, invoice)


@router.post("/invoices/{invoice_id}/repair-settlement", response_model=InvoiceAdminDetailResponse)
async def repair_invoice_settlement(
    invoice_id: str,
    _: User = Depends(require_platform_permission("admin.invoices.write")),
    db: AsyncSession = Depends(get_db),
) -> InvoiceAdminDetailResponse:
    invoice_service = InvoiceService(db)
    try:
        invoice = await invoice_service.repair_misconverted_settlement(invoice_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return await _map_invoice_admin_detail_response(db, invoice)


@router.post("/invoices/{invoice_id}/sync", response_model=InvoiceAdminDetailResponse)
async def sync_invoice_status(
    invoice_id: str,
    _: User = Depends(require_platform_permission("admin.invoices.write")),
    db: AsyncSession = Depends(get_db),
) -> InvoiceAdminDetailResponse:
    return await _get_admin_invoice_detail(db, invoice_id, sync=True)


@router.get("/payouts", response_model=list[PayoutRequestResponse])
async def list_all_payout_requests(
    _: User = Depends(require_platform_permission("admin.payouts.read")),
    db: AsyncSession = Depends(get_db),
) -> list[PayoutRequestResponse]:
    payout_service = PayoutService(db)
    payouts = await payout_service.list_all()
    tenant_names = {
        item.id: item.name
        for item in (await db.scalars(select(Tenant))).all()
    }
    project_names = {
        item.id: item.name
        for item in (await db.scalars(select(Project))).all()
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
    db: AsyncSession = Depends(get_db),
) -> list[PayoutRequestResponse]:
    payout_service = PayoutService(db)
    payouts = await payout_service.list_by_tenant(tenant_id)
    project_names = {
        item.id: item.name
        for item in (await db.scalars(select(Project).where(Project.tenant_id == tenant_id))).all()
    }
    tenant_name = await db.scalar(select(Tenant.name).where(Tenant.id == tenant_id))
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
    db: AsyncSession = Depends(get_db),
) -> PayoutRequestResponse:
    payout_service = PayoutService(db)
    notification_service = NotificationService(db)
    try:
        payout = await payout_service.review_request(
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
    await notification_service.notify_tenant_users(
        payout.tenant_id,
        event_code=(
            NotificationService.EVENT_PAYOUT_APPROVED
            if is_approved
            else NotificationService.EVENT_PAYOUT_REJECTED
        ),
        subject=(
            "Payout request approved"
            if is_approved
            else "Payout request rejected"
        ),
        lines=[
            f"Payout ID: {payout.id}",
            f"Amount: {payout.amount_requested} {payout.currency}",
            f"Status: {payout.status}",
            f"Comment: {payload.review_comment or '-'}",
        ],
        owner_only=True,
    )
    tenant_name = await db.scalar(select(Tenant.name).where(Tenant.id == payout.tenant_id))
    project_name = await db.scalar(select(Project.name).where(Project.id == payout.project_id)) if payout.project_id else None
    await notify_platform_ops(
        db,
        event_code="payout_approved" if is_approved else "payout_rejected",
        title="Выплата одобрена" if is_approved else "Выплата отклонена",
        lines=[
            f"Мерчант: {tenant_name or payout.tenant_id}",
            f"Payout ID: {payout.id}",
            f"Сумма: {payout.amount_requested} {payout.currency}",
            f"Ревьюер: {reviewer.email}",
            f"Комментарий: {payload.review_comment or '-'}",
        ],
        admin_url="/admin/payouts",
    )
    return _map_payout_response(payout, tenant_name=tenant_name, project_name=project_name)


async def _map_platform_billing_settings_response(
    *,
    platform_settings,
    notification_service: NotificationService,
    current_exchange_rates: dict[str, Decimal] | None = None,
    include_ops_telegram: bool = False,
) -> PlatformBillingSettingsResponse:
    ops_telegram: OpsTelegramSettingsView | None = None
    if include_ops_telegram:
        ops_service = PlatformOpsTelegramService(notification_service.db)
        ops_telegram = OpsTelegramSettingsView(
            enabled=bool(platform_settings.ops_telegram_enabled),
            chat_id=platform_settings.ops_telegram_chat_id,
            topics=[OpsTelegramTopicView(**item) for item in ops_service.get_topic_views(platform_settings)],
            events=[OpsTelegramEventView(**item) for item in ops_service.get_event_views(platform_settings)],
        )

    return PlatformBillingSettingsResponse(
        provider_fee_percent=platform_settings.provider_fee_percent,
        default_markup_percent=platform_settings.default_markup_percent,
        default_turnover_fee_percent=Decimal("0"),
        platform_markup_min_usdt=platform_settings.platform_markup_min_usdt,
        platform_fee_min_usdt=platform_settings.platform_fee_min_usdt,
        platform_markup_min_band_usdt_low=Decimal("0"),
        platform_markup_min_band_usdt_high=Decimal("0"),
        allow_tenant_markup_override=platform_settings.allow_tenant_markup_override,
        allow_tenant_turnover_fee_override=False,
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
        notification_logo_url=BrandLogoService.web_url_for_stored_path(
            platform_settings.notification_logo_url
        ),
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
        exchange_rate_price_field=(
            platform_settings.exchange_rate_price_field
            if platform_settings.exchange_rate_price_field in {"last", "buy", "sell"}
            else "last"
        ),
        manual_exchange_rates=await BillingPolicyService(notification_service.db).get_manual_exchange_rates(),
        current_exchange_rates=current_exchange_rates or {},
        ops_telegram=ops_telegram,
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
        payment_memo=read_stored_payment_memo(invoice.raw_provider_payload_json),
        qr_url=invoice.qr_url,
        payment_page_url=PaymentPageService.payment_page_url_for(invoice),
        status=invoice.status,
        expires_at=invoice.expires_at,
        created_at=invoice.created_at,
        **confirmations_fields_from_stored(invoice),
    )


async def _map_invoice_admin_detail_response(
    db: AsyncSession,
    invoice: Invoice,
) -> InvoiceAdminDetailResponse:
    transaction = await TransactionService(db).get_latest_for_invoice(invoice.id)
    details_payload = await build_invoice_transaction_details(
        db,
        invoice,
        transaction,
        include_exchange_rate=invoice.status == "confirmed",
    )
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
        payment_page_url=PaymentPageService.payment_page_url_for(invoice),
        status=invoice.status,
        expires_at=invoice.expires_at,
        created_at=invoice.created_at,
        paid_at=invoice.paid_at,
        confirmed_at=invoice.confirmed_at,
        metadata_json=invoice.metadata_json,
        raw_provider_payload_json=invoice.raw_provider_payload_json,
        transaction_details=(
            InvoiceTransactionDetailsResponse(**details_payload) if details_payload else None
        ),
    )


def _map_transaction_response(transaction, invoice: Invoice | None = None) -> TransactionResponse:
    return TransactionResponse(
        id=transaction.id,
        tenant_id=transaction.tenant_id,
        project_id=transaction.project_id,
        invoice_id=transaction.invoice_id,
        amount_crypto=invoice.amount_crypto if invoice is not None else None,
        crypto_currency=invoice.crypto_currency if invoice is not None else None,
        gross_amount=transaction.gross_amount,
        provider_fee=transaction.provider_fee,
        platform_fee=transaction.platform_fee,
        turnover_fee=transaction.turnover_fee,
        net_amount=transaction.net_amount,
        currency=transaction.currency,
        status=transaction.status,
        invoice_status=invoice.status if invoice is not None else None,
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
    db: AsyncSession = Depends(get_db),
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

    superadmin = await db.scalar(
        select(User).where(User.role == "superadmin").order_by(User.created_at.asc())
    )
    if superadmin:
        if not superadmin.totp_enabled:
            warnings.append({"code": "no_mfa_superadmin", "message": "Superadmin does not have 2FA enabled"})

        if superadmin.password_hash == get_password_hash("admin") or \
           superadmin.password_hash == get_password_hash("password") or \
           superadmin.password_hash == get_password_hash("ChangeMe123!"):
            issues.append({"code": "weak_superadmin_password", "message": "Superadmin password appears to be weak"})

    pending_tenants = list((await db.scalars(
        select(Tenant).where(Tenant.status == "pending_review")
    )).all())
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
