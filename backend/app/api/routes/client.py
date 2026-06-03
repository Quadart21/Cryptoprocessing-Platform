from typing import Any, Literal

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ClientAuthContext,
    get_client_auth_context,
    get_current_user,
    get_db,
    require_tenant_permission,
    require_tenant_user,
    user_permissions,
)
from app.core.rbac import has_permission
from app.models.invoice import Invoice
from app.models.project import Project
from app.models.tenant import Tenant
from app.models.user import User
from app.providers.crypto_cash import CryptoCashProviderError, provider_error_http_status
from app.schemas.accounting import AccountingSummaryResponse
from app.schemas.auth import (
    PasswordRecoveryRequest,
    PasswordRecoveryResponse,
    SetPasswordRequest,
    TokenPairResponse,
)
from app.schemas.invoice import (
    BalanceResponse,
    InvoiceCreateRequest,
    InvoiceDetailResponse,
    InvoiceResponse,
    InvoiceSettlementResponse,
    InvoiceTransactionDetailsResponse,
)
from app.schemas.onboarding import OnboardingStatusResponse
from app.schemas.notification import (
    MerchantNotificationSettingsResponse,
    MerchantNotificationSettingsUpdateRequest,
)
from app.schemas.project import (
    ApiKeyRegenerateResponse,
    ApiKeySummary,
    InvoiceWebhookTestResponse,
    ProjectSummary,
    WebhookConfigRequest,
    WebhookConfigResponse,
    WebhookTestRequest,
    WebhookTestResponse,
)
from app.schemas.payout import PayoutRequestCreateRequest, PayoutRequestResponse
from app.schemas.public_page import PublicPageListResponse, PublicPageNavigationItem, PublicPageResponse
from app.schemas.rates import RatesResponse
from app.schemas.registration import RegistrationResponse
from app.schemas.security import (
    PasswordChangeRequest,
    TwoFactorDisableRequest,
    TwoFactorEnableRequest,
    TwoFactorSetupResponse,
    TwoFactorStatusResponse,
)
from app.schemas.transaction import TransactionResponse
from app.schemas.user import CurrentUserResponse
from app.services.accounting_service import AccountingService
from app.services.auth_service import AuthError, AuthService
from app.services.balance_service import BalanceService
from app.services.client_webhook_service import ClientWebhookService
from app.services.event_service import EventService
from app.services.invoice_confirmations import confirmations_fields_from_stored
from app.services.invoice_service import InvoiceAmountOutOfRangeError, InvoiceService
from app.services.invoice_transaction_details import build_invoice_transaction_details
from app.services.notification_service import NotificationService
from app.services.project_service import ProjectService
from app.services.rates_service import RatesService
from app.services.payout_service import PayoutService
from app.services.tenant_service import TenantService
from app.services.two_factor_service import TwoFactorError, TwoFactorService
from app.services.transaction_service import TransactionService
from app.services.checkout_delivery_service import CheckoutDeliveryService
from app.services.payment_page_service import PaymentPageService
from app.services.public_page_service import PublicPageService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def client_health() -> dict[str, str]:
    return {"status": "ok", "scope": "client"}


@router.get("/public-pages", response_model=PublicPageListResponse)
async def list_public_pages(
    status_filter: Literal["published"] = "published",
    db: AsyncSession = Depends(get_db),
) -> PublicPageListResponse:
    service = PublicPageService(db)
    pages = await service.list_published_pages()
    return PublicPageListResponse(
        items=[
            PublicPageNavigationItem(
                slug=item.slug,
                title=item.title,
                show_in_header=item.show_in_header,
                show_in_footer=item.show_in_footer,
                header_order=item.header_order,
                footer_order=item.footer_order,
            )
            for item in pages
        ]
    )


@router.get("/public-pages/{slug}", response_model=PublicPageResponse)
async def get_public_page_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> PublicPageResponse:
    page = await PublicPageService(db).get_published_page_by_slug(slug)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Страница не найдена.")
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


@router.post("/auth/login", response_model=TokenPairResponse)
async def login(payload: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> TokenPairResponse:
    email = _normalize_input(payload.get("email"))
    password = _normalize_input(payload.get("password"))
    otp_code = _normalize_input(payload.get("otp_code"))
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите email и пароль.",
        )
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен быть не короче 8 символов.",
        )

    device_fingerprint = _normalize_input(payload.get("device_fingerprint"))
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    auth_service = AuthService(db)
    try:
        return await auth_service.login(
            email, password, otp_code=otp_code or None,
            device_fingerprint=device_fingerprint,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/auth/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: dict[str, Any], db: AsyncSession = Depends(get_db)
) -> RegistrationResponse:
    company_name = _normalize_input(payload.get("company_name"))
    owner_full_name = _normalize_input(payload.get("owner_full_name"))
    owner_email = _normalize_input(payload.get("owner_email"))
    password = _normalize_input(payload.get("password"))
    domain = _normalize_input(payload.get("domain"))
    project_description = _normalize_input(payload.get("project_description")) or None
    timezone = _normalize_input(payload.get("timezone")) or "Europe/Amsterdam"
    base_currency = _normalize_input(payload.get("base_currency")) or "USD"
    plan = _normalize_input(payload.get("plan")) or "default"

    missing_fields: list[str] = []
    if not company_name:
        missing_fields.append("company_name")
    if not owner_full_name:
        missing_fields.append("owner_full_name")
    if not owner_email:
        missing_fields.append("owner_email")
    if not password:
        missing_fields.append("password")
    if not domain:
        missing_fields.append("domain")
    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заполните обязательные поля: {', '.join(missing_fields)}.",
        )
    if "@" not in owner_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Введите корректный email владельца.",
        )
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен быть не короче 8 символов.",
        )
    if len(domain) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Домен проекта должен содержать минимум 3 символа.",
        )

    tenant_service = TenantService(db)
    try:
        tenant, user, _project = await tenant_service.register_self_service(
            company_name=company_name,
            owner_full_name=owner_full_name,
            owner_email=owner_email,
            password=password,
            domain=domain,
            project_description=project_description,
            timezone=timezone,
            base_currency=base_currency,
            plan=plan,
        )
    except ValueError as exc:
        await db.rollback()
        logger.warning("Registration validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        await db.rollback()
        logger.exception("Registration integrity error")
        error_text = str(exc).lower()
        if "ix_projects_domain" in error_text or "projects_domain" in error_text:
            detail = "Домен проекта уже используется. Укажите другой домен."
        elif "ix_users_email" in error_text or "users_email" in error_text:
            detail = "Email владельца уже используется. Укажите другой email."
        elif "ix_tenants_slug" in error_text or "tenants_slug" in error_text:
            detail = "Компания с похожим именем уже зарегистрирована. Уточните название компании."
        else:
            detail = "Не удалось подключить проект из-за конфликта уникальности данных."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        ) from exc
    except OperationalError as exc:
        await db.rollback()
        logger.exception("Registration database connectivity error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис регистрации временно недоступен: ошибка подключения к базе данных.",
        ) from exc
    except Exception as exc:
        await db.rollback()
        logger.exception("Unexpected registration error")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось подключить проект. Проверьте корректность данных и попробуйте снова.",
        ) from exc

    await NotificationService(db).notify_user(
        user,
        event_code=NotificationService.EVENT_APPLICATION_SUBMITTED,
        subject="Заявка на подключение проекта получена",
        lines=[
            f"Проект: {tenant.name}",
            "Заявка отправлена на модерацию.",
        ],
    )

    return RegistrationResponse(
        tenant_id=tenant.id,
        user_id=user.id,
        status=tenant.status,
        message="Заявка на подключение проекта создана и ожидает одобрения супер-админом.",
    )


@router.post("/auth/set-password")
async def set_password(
    payload: SetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    auth_service = AuthService(db)
    try:
        user = await auth_service.set_password_by_invite(payload.token, payload.password)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    await NotificationService(db).notify_user(
        user,
        event_code=NotificationService.EVENT_PASSWORD_CHANGED,
        subject="Пароль для входа установлен",
        lines=[
            "Пароль был успешно установлен через invite-ссылку.",
            "Если это были не вы, срочно обратитесь в поддержку.",
        ],
    )

    return {
        "status": "ok",
        "message": "Пароль установлен.",
        "user_id": user.id,
        "email": user.email,
    }


@router.post("/auth/recover-password", response_model=PasswordRecoveryResponse)
async def recover_password(
    payload: PasswordRecoveryRequest,
    db: AsyncSession = Depends(get_db),
) -> PasswordRecoveryResponse:
    normalized_email = payload.email.strip().lower()
    user = await db.scalar(
        select(User).where(
            User.email == normalized_email,
            User.tenant_id.is_not(None),
            User.role.in_(["tenant_owner", "tenant_manager", "tenant_finance", "tenant_support"]),
        )
    )

    if user is not None and user.status in {"active", "invited"}:
        token = await AuthService(db).create_invite(user)
        await NotificationService(db).notify_user(
            user,
            event_code=NotificationService.EVENT_PASSWORD_GENERATED,
            subject="Запрошено восстановление пароля",
            lines=[
                f"Email: {user.email}",
                f"Токен восстановления: {token}",
                "Введите токен на форме восстановления пароля и установите новый пароль.",
            ],
            force_email=True,
        )

    return PasswordRecoveryResponse(
        status="ok",
        message=(
            "Если пользователь с таким email найден, инструкция по восстановлению уже отправлена."
        ),
    )


@router.get("/me", response_model=CurrentUserResponse)
async def client_me(current_user: User = Depends(get_current_user)) -> CurrentUserResponse:
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


@router.get("/security/2fa/status", response_model=TwoFactorStatusResponse)
async def get_two_factor_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TwoFactorStatusResponse:
    payload = TwoFactorService(db).get_status(current_user)
    return TwoFactorStatusResponse(**payload)


@router.post("/security/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TwoFactorSetupResponse:
    payload = await TwoFactorService(db).setup(current_user)
    return TwoFactorSetupResponse(**payload)


@router.post("/security/2fa/enable", response_model=TwoFactorStatusResponse)
async def enable_two_factor(
    payload: TwoFactorEnableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TwoFactorStatusResponse:
    two_factor_service = TwoFactorService(db)
    try:
        user = await two_factor_service.enable(current_user, payload.code)
    except TwoFactorError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await NotificationService(db).notify_user(
        user,
        event_code=NotificationService.EVENT_TWO_FACTOR_ENABLED,
        subject="2FA включена",
        lines=[
            f"Пользователь: {user.email}",
            "Дополнительная защита входа успешно активирована.",
        ],
    )
    status_payload = two_factor_service.get_status(user)
    return TwoFactorStatusResponse(**status_payload)


@router.post("/security/2fa/disable", response_model=TwoFactorStatusResponse)
async def disable_two_factor(
    payload: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TwoFactorStatusResponse:
    two_factor_service = TwoFactorService(db)
    try:
        user = await two_factor_service.disable(
            current_user,
            password=payload.password,
            code=payload.code,
        )
    except TwoFactorError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await NotificationService(db).notify_user(
        user,
        event_code=NotificationService.EVENT_TWO_FACTOR_DISABLED,
        subject="2FA отключена",
        lines=[
            f"Пользователь: {user.email}",
            "Если это были не вы, срочно смените пароль.",
        ],
    )
    status_payload = two_factor_service.get_status(user)
    return TwoFactorStatusResponse(**status_payload)


@router.post("/security/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    auth_service = AuthService(db)
    try:
        user = await auth_service.change_password(
            current_user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await NotificationService(db).notify_user(
        user,
        event_code=NotificationService.EVENT_PASSWORD_CHANGED,
        subject="Пароль изменен",
        lines=[
            f"Пользователь: {user.email}",
            "Пароль от кабинета мерчанта успешно обновлен.",
        ],
    )
    return {"status": "ok", "message": "Пароль изменен."}


@router.get("/notifications/settings", response_model=MerchantNotificationSettingsResponse)
async def get_notification_settings(
    current_user: User = Depends(require_tenant_user),
    db: AsyncSession = Depends(get_db),
) -> MerchantNotificationSettingsResponse:
    payload = NotificationService(db).get_user_notification_settings(current_user)
    return MerchantNotificationSettingsResponse(**payload)


@router.put("/notifications/settings", response_model=MerchantNotificationSettingsResponse)
async def update_notification_settings(
    payload: MerchantNotificationSettingsUpdateRequest,
    current_user: User = Depends(require_tenant_user),
    db: AsyncSession = Depends(get_db),
) -> MerchantNotificationSettingsResponse:
    notification_service = NotificationService(db)
    user = await notification_service.update_user_notification_settings(
        current_user,
        notify_email_enabled=payload.notify_email_enabled,
        notify_telegram_enabled=payload.notify_telegram_enabled,
        telegram_chat_id=payload.telegram_chat_id,
    )
    return MerchantNotificationSettingsResponse(
        **notification_service.get_user_notification_settings(user)
    )


@router.get("/cabinet")
async def client_cabinet(current_user: User = Depends(require_tenant_user)) -> dict[str, str]:
    return {
        "status": "ok",
        "message": f"Добро пожаловать, {current_user.full_name}. Кабинет доступен.",
    }


@router.get("/onboarding/status", response_model=OnboardingStatusResponse)
async def onboarding_status(
    current_user: User = Depends(require_tenant_user), db: AsyncSession = Depends(get_db)
) -> OnboardingStatusResponse:
    tenant = await db.get(Tenant, current_user.tenant_id) if current_user.tenant_id else None
    project = (
        await db.scalar(
            select(Project)
            .where(Project.tenant_id == current_user.tenant_id)
            .order_by(Project.created_at.asc())
        )
        if current_user.tenant_id
        else None
    )
    return OnboardingStatusResponse(
        tenant_id=current_user.tenant_id,
        tenant_status=tenant.status if tenant else None,
        review_comment=tenant.review_comment if tenant else None,
        project_name=project.name if project else None,
        project_domain=project.domain if project else None,
        project_description=project.description if project else None,
        project_status=project.status if project else None,
    )


@router.get("/projects", response_model=list[ProjectSummary])
async def client_projects(
    current_user: User = Depends(require_tenant_permission("client.projects.read")),
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
        for project in await project_service.list_projects_by_tenant(current_user.tenant_id or "")
    ]


@router.get("/api-keys", response_model=list[ApiKeySummary])
async def client_api_keys(
    current_user: User = Depends(require_tenant_permission("client.api_keys.read")),
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
        for api_key in await project_service.list_api_keys_by_tenant(current_user.tenant_id or "")
    ]


@router.post("/api-keys/{api_key_id}/revoke", response_model=ApiKeySummary)
async def revoke_client_api_key(
    api_key_id: str,
    current_user: User = Depends(require_tenant_permission("client.api_keys.write")),
    db: AsyncSession = Depends(get_db),
) -> ApiKeySummary:
    project_service = ProjectService(db)
    notification_service = NotificationService(db)
    api_key = await project_service.get_api_key(api_key_id)
    if api_key is None or api_key.tenant_id != (current_user.tenant_id or ""):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key не найден.")
    revoked = await project_service.revoke_api_key(api_key_id)
    await notification_service.notify_tenant_users(
        revoked.tenant_id,
        event_code=NotificationService.EVENT_API_KEY_REVOKED,
        subject="API-ключ отозван",
        lines=[
            f"Public key: {revoked.public_key}",
            f"Инициатор: {current_user.email}",
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
async def regenerate_client_api_key(
    api_key_id: str,
    current_user: User = Depends(require_tenant_permission("client.api_keys.write")),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyRegenerateResponse:
    project_service = ProjectService(db)
    notification_service = NotificationService(db)
    api_key = await project_service.get_api_key(api_key_id)
    if api_key is None or api_key.tenant_id != (current_user.tenant_id or ""):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key не найден.")
    regenerated, secret_key = await project_service.regenerate_api_key(api_key_id)
    await notification_service.notify_tenant_users(
        regenerated.tenant_id,
        event_code=NotificationService.EVENT_API_KEY_REGENERATED,
        subject="API-ключ перевыпущен",
        lines=[
            f"Public key: {regenerated.public_key}",
            f"Secret key: {secret_key}",
            f"Инициатор: {current_user.email}",
        ],
        owner_only=True,
    )
    return ApiKeyRegenerateResponse(
        id=regenerated.id,
        project_id=regenerated.project_id,
        public_key=regenerated.public_key,
        status=regenerated.status,
        secret_key=secret_key,
    )


@router.post("/webhooks", response_model=WebhookConfigResponse)
async def configure_webhook(
    payload: WebhookConfigRequest,
    current_user: User = Depends(require_tenant_permission("client.webhooks.write")),
    db: AsyncSession = Depends(get_db),
) -> WebhookConfigResponse:
    project_service = ProjectService(db)
    try:
        project = await project_service.update_webhook_config(
            tenant_id=current_user.tenant_id or "",
            project_id=payload.project_id,
            webhook_url=payload.webhook_url,
            webhook_secret=payload.webhook_secret,
            checkout_delivery=payload.checkout_delivery,
            return_url_success=payload.return_url_success,
            return_url_failed=payload.return_url_failed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WebhookConfigResponse(
        project_id=project.id,
        webhook_url=project.webhook_url,
        has_secret=ProjectService.has_webhook_secret(project),
        checkout_delivery=CheckoutDeliveryService.normalize(project.checkout_delivery),
        return_url_success=project.return_url_success,
        return_url_failed=project.return_url_failed,
    )


@router.get("/webhooks", response_model=list[WebhookConfigResponse])
async def list_webhooks(
    current_user: User = Depends(require_tenant_permission("client.webhooks.read")),
    db: AsyncSession = Depends(get_db),
) -> list[WebhookConfigResponse]:
    project_service = ProjectService(db)
    return [
        WebhookConfigResponse(
            project_id=project.id,
            webhook_url=project.webhook_url,
            has_secret=ProjectService.has_webhook_secret(project),
            checkout_delivery=CheckoutDeliveryService.normalize(project.checkout_delivery),
            return_url_success=project.return_url_success,
            return_url_failed=project.return_url_failed,
        )
        for project in await project_service.list_projects_by_tenant(current_user.tenant_id or "")
    ]


@router.post("/webhooks/test", response_model=WebhookTestResponse)
async def test_webhook_delivery(
    payload: WebhookTestRequest,
    current_user: User = Depends(require_tenant_permission("client.webhooks.write")),
    db: AsyncSession = Depends(get_db),
) -> WebhookTestResponse:
    project_service = ProjectService(db)
    project = await project_service.get_project(payload.project_id)
    if project is None or project.tenant_id != (current_user.tenant_id or ""):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден.")

    try:
        result = ClientWebhookService(EventService(db)).send_test_ping(project)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return WebhookTestResponse(
        project_id=project.id,
        webhook_url=project.webhook_url or "",
        event_id=str(result["event_id"]),
        delivered_at=result["delivered_at"],
        attempts=int(result["attempts"]),
        status_code=int(result["status_code"]),
        response_preview=result.get("response_preview"),
    )


@router.post("/invoices/{invoice_id}/webhook-test", response_model=InvoiceWebhookTestResponse)
async def test_invoice_webhook_simulation(
    invoice_id: str,
    current_user: User = Depends(require_tenant_permission("client.webhooks.write")),
    db: AsyncSession = Depends(get_db),
) -> InvoiceWebhookTestResponse:
    tenant_id = current_user.tenant_id or ""
    invoice_service = InvoiceService(db)
    invoice = await invoice_service.get_invoice(tenant_id, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Инвойс не найден.")

    project_service = ProjectService(db)
    project = await project_service.get_project(invoice.project_id)
    if project is None or project.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден.")

    tx_service = TransactionService(db)
    transaction = await tx_service.get_latest_for_invoice(invoice_id)

    try:
        result = ClientWebhookService(EventService(db)).send_invoice_deposit_test(
            project,
            invoice,
            transaction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return InvoiceWebhookTestResponse(
        project_id=project.id,
        invoice_id=invoice.id,
        webhook_url=project.webhook_url or "",
        event_id=str(result["event_id"]),
        delivered_at=result["delivered_at"],
        attempts=int(result["attempts"]),
        status_code=int(result["status_code"]),
        response_preview=result.get("response_preview"),
        ok=bool(result["ok"]),
        error=result.get("error"),
    )


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreateRequest,
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
) -> InvoiceResponse:
    _ensure_client_api_permission(auth, "client.invoices.write")
    if auth.project_id is not None and payload.project_id != auth.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API-ключ привязан к другому проекту.",
        )
    invoice_service = InvoiceService(db)
    try:
        invoice = await invoice_service.create_invoice(auth.tenant_id, payload)
    except InvoiceAmountOutOfRangeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.to_response_detail(),
        ) from exc
    except CryptoCashProviderError as exc:
        raise HTTPException(
            status_code=_map_provider_error_status_code(exc),
            detail=exc.to_public_detail(),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception:
        logger.exception(
            "Unexpected invoice create error for tenant_id=%s project_id=%s merchant_order_id=%s",
            auth.tenant_id,
            payload.project_id,
            payload.merchant_order_id,
        )
        raise
    try:
        project = await ProjectService(db).get_project(invoice.project_id)
        checkout_delivery = (
            CheckoutDeliveryService.normalize(project.checkout_delivery)
            if project is not None
            else CheckoutDeliveryService.normalize(None)
        )
        return _map_invoice_response(invoice, checkout_delivery=checkout_delivery)
    except Exception:
        logger.exception("Unexpected invoice create response mapping error")
        raise


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[InvoiceResponse]:
    _ensure_client_api_permission(auth, "client.invoices.read")
    invoice_service = InvoiceService(db)
    try:
        projects_by_id = await _project_checkout_map(db, auth.tenant_id)
        return [
            _map_invoice_response(
                invoice,
                checkout_delivery=_checkout_delivery_for_invoice(invoice, projects_by_id),
            )
            for invoice in await invoice_service.list_invoices(
                auth.tenant_id,
                project_id=auth.project_id,
                limit=limit,
                offset=offset,
            )
        ]
    except Exception:
        logger.exception("Unexpected invoice list error")
        raise


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice(
    invoice_id: str,
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
) -> InvoiceDetailResponse:
    _ensure_client_api_permission(auth, "client.invoices.read")
    invoice_service = InvoiceService(db)
    invoice = await invoice_service.get_invoice(auth.tenant_id, invoice_id, project_id=auth.project_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Инвойс не найден.")
    try:
        project = await ProjectService(db).get_project(invoice.project_id)
        checkout_delivery = (
            CheckoutDeliveryService.normalize(project.checkout_delivery)
            if project is not None
            else CheckoutDeliveryService.normalize(None)
        )
        transaction = await TransactionService(db).get_latest_for_invoice(invoice.id)
        return await _map_invoice_detail_response(
            db,
            invoice,
            checkout_delivery=checkout_delivery,
            transaction=transaction,
        )
    except Exception:
        logger.exception("Unexpected invoice detail error for invoice_id=%s", invoice_id)
        raise


@router.post("/invoices/{invoice_id}/sync", response_model=InvoiceDetailResponse)
async def sync_invoice(
    invoice_id: str,
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
) -> InvoiceDetailResponse:
    _ensure_client_api_permission(auth, "client.invoices.write")
    invoice_service = InvoiceService(db)
    invoice = await invoice_service.get_invoice(auth.tenant_id, invoice_id, project_id=auth.project_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Инвойс не найден.")
    if auth.project_id is not None and invoice.project_id != auth.project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Инвойс не найден.")
    try:
        invoice = await invoice_service.sync_invoice_status(
            tenant_id=auth.tenant_id,
            invoice_id=invoice_id,
            project_id=auth.project_id,
        )
    except CryptoCashProviderError as exc:
        raise HTTPException(
            status_code=_map_provider_error_status_code(exc),
            detail=exc.to_public_detail(),
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    try:
        project = await ProjectService(db).get_project(invoice.project_id)
        checkout_delivery = (
            CheckoutDeliveryService.normalize(project.checkout_delivery)
            if project is not None
            else CheckoutDeliveryService.normalize(None)
        )
        transaction = await TransactionService(db).get_latest_for_invoice(invoice.id)
        return await _map_invoice_detail_response(
            db,
            invoice,
            checkout_delivery=checkout_delivery,
            transaction=transaction,
        )
    except Exception:
        logger.exception("Unexpected invoice sync response mapping error for invoice_id=%s", invoice_id)
        raise


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
) -> BalanceResponse:
    _ensure_client_api_permission(auth, "client.balance.read")
    balance_service = BalanceService(db)
    balance = await balance_service.get_or_create_balance(auth.tenant_id, PayoutService.BALANCE_CURRENCY)
    available_amount = balance.available_amount
    locked_amount = balance.locked_amount
    return BalanceResponse(
        currency=PayoutService.BALANCE_CURRENCY,
        amount=available_amount,
        available_amount=available_amount,
        locked_amount=locked_amount,
        total_amount=available_amount + locked_amount,
    )


@router.get("/rates", response_model=RatesResponse)
async def get_rates(
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
) -> RatesResponse:
    _ensure_client_api_permission(auth, "client.rates.read")
    return await RatesService(db).list_rates()


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[TransactionResponse]:
    _ensure_client_api_permission(auth, "client.transactions.read")
    transaction_service = TransactionService(db)
    transactions = await transaction_service.list_by_tenant(
        auth.tenant_id,
        project_id=auth.project_id,
        limit=limit,
        offset=offset,
    )
    invoice_ids = list({transaction.invoice_id for transaction in transactions})
    invoices_by_id: dict[str, Invoice] = {}
    if invoice_ids:
        invoices = list(
            (
                await db.scalars(
                    select(Invoice).where(
                        Invoice.tenant_id == auth.tenant_id,
                        Invoice.id.in_(invoice_ids),
                    )
                )
            ).all()
        )
        invoices_by_id = {str(invoice.id): invoice for invoice in invoices}
    return [
        _map_transaction_response(transaction, invoices_by_id.get(transaction.invoice_id))
        for transaction in transactions
    ]


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    auth: ClientAuthContext = Depends(get_client_auth_context),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    _ensure_client_api_permission(auth, "client.transactions.read")
    transaction_service = TransactionService(db)
    transaction = await transaction_service.get_by_id(transaction_id)
    if transaction is None or transaction.tenant_id != auth.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Транзакция не найдена.",
        )
    if auth.project_id is not None and transaction.project_id != auth.project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Транзакция не найдена.",
        )
    invoice = await db.get(Invoice, transaction.invoice_id)
    return _map_transaction_response(transaction, invoice)


@router.get("/accounting/summary", response_model=AccountingSummaryResponse)
async def get_accounting_summary(
    current_user: User = Depends(require_tenant_permission("client.accounting.read")),
    db: AsyncSession = Depends(get_db),
) -> AccountingSummaryResponse:
    accounting_service = AccountingService(db)
    return await accounting_service.build_summary(current_user.tenant_id or "")


@router.post("/payouts", response_model=PayoutRequestResponse, status_code=status.HTTP_201_CREATED)
async def request_payout(
    payload: PayoutRequestCreateRequest,
    current_user: User = Depends(require_tenant_permission("client.payouts.write")),
    db: AsyncSession = Depends(get_db),
) -> PayoutRequestResponse:
    # Payout requests are available only for authenticated cabinet users.
    if payload.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API-ключ привязан к другому проекту.",
        )
    payout_service = PayoutService(db)
    try:
        payout = await payout_service.create_request(
            tenant_id=current_user.tenant_id or "",
            requested_by_user_id=current_user.id,
            project_id=payload.project_id,
            destination_address=payload.destination_address,
            amount=payload.amount,
            note=payload.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await NotificationService(db).notify_tenant_users(
        current_user.tenant_id or "",
        event_code=NotificationService.EVENT_PAYOUT_REQUESTED,
        subject="Создан запрос на выплату",
        lines=[
            f"Payout ID: {payout.id}",
            f"Сумма: {payout.amount_requested} {payout.currency}",
            f"Адрес: {payout.destination_address}",
            f"Инициатор: {current_user.email}",
        ],
        owner_only=True,
    )
    project_name = await db.scalar(select(Project.name).where(Project.id == payout.project_id)) if payout.project_id else None
    return _map_payout_response(payout, project_name=project_name)


@router.get("/payouts", response_model=list[PayoutRequestResponse])
async def list_payouts(
    current_user: User = Depends(require_tenant_permission("client.payouts.read")),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[PayoutRequestResponse]:
    payout_service = PayoutService(db)
    payouts = await payout_service.list_by_tenant(current_user.tenant_id or "", limit=limit, offset=offset)
    projects = (
        await db.scalars(
            select(Project).where(Project.tenant_id == (current_user.tenant_id or ""))
        )
    ).all()
    project_names = {item.id: item.name for item in projects}
    return [
        _map_payout_response(
            item,
            project_name=project_names.get(item.project_id) if item.project_id else None,
        )
        for item in payouts
    ]


def _ensure_client_api_permission(auth: ClientAuthContext, permission: str) -> None:
    if auth.user is None:
        # API-key integrations are service-level and bypass user-role checks.
        return
    if auth.user.role == "superadmin":
        return
    if not has_permission(auth.user.role, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Недостаточно прав: {permission}.",
        )

def _map_invoice_response(
    invoice: Invoice,
    *,
    checkout_delivery: str | None = None,
) -> InvoiceResponse:
    payment_fields = CheckoutDeliveryService.apply(
        checkout_delivery,
        payment_page_url=PaymentPageService.payment_page_url_for(invoice),
        payment_address=invoice.payment_address,
        qr_url=invoice.qr_url,
    )
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
        payment_address=payment_fields.payment_address,
        qr_url=payment_fields.qr_url,
        payment_page_url=payment_fields.payment_page_url,
        checkout_delivery=payment_fields.checkout_delivery,
        status=invoice.status,
        expires_at=invoice.expires_at,
        created_at=invoice.created_at,
        **confirmations_fields_from_stored(invoice),
    )


def _map_invoice_settlement(
    invoice: Invoice,
    transaction,
) -> InvoiceSettlementResponse | None:
    if transaction is None:
        return None
    processing_fee = transaction.provider_fee
    platform_fee = transaction.platform_fee + transaction.turnover_fee
    total_fee = processing_fee + platform_fee
    paid_like = invoice.status in {"paid", "confirmed"} or transaction.status in {"paid", "confirmed"}
    return InvoiceSettlementResponse(
        amount_crypto=invoice.amount_crypto,
        crypto_currency=invoice.crypto_currency,
        gross_amount=transaction.gross_amount,
        processing_fee=processing_fee,
        platform_fee=platform_fee,
        total_fee=total_fee,
        net_amount=transaction.net_amount,
        currency=transaction.currency,
        is_final=paid_like,
        paid_at=transaction.paid_at,
    )


async def _map_invoice_detail_response(
    db: AsyncSession,
    invoice: Invoice,
    *,
    checkout_delivery: str | None = None,
    transaction=None,
) -> InvoiceDetailResponse:
    base = _map_invoice_response(invoice, checkout_delivery=checkout_delivery)
    details_payload = await build_invoice_transaction_details(db, invoice, transaction)
    return InvoiceDetailResponse(
        **base.model_dump(),
        settlement=_map_invoice_settlement(invoice, transaction),
        transaction_details=InvoiceTransactionDetailsResponse(**details_payload),
    )


async def _project_checkout_map(db: AsyncSession, tenant_id: str) -> dict[str, str]:
    project_service = ProjectService(db)
    projects = await project_service.list_projects_by_tenant(tenant_id)
    return {
        project.id: CheckoutDeliveryService.normalize(project.checkout_delivery)
        for project in projects
    }


def _checkout_delivery_for_invoice(
    invoice: Invoice,
    projects_by_id: dict[str, str],
) -> str:
    return projects_by_id.get(invoice.project_id, CheckoutDeliveryService.normalize(None))


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
        paid_at=transaction.paid_at,
        created_at=transaction.created_at,
    )


def _map_payout_response(
    payout,
    *,
    project_name: str | None = None,
) -> PayoutRequestResponse:
    return PayoutRequestResponse(
        id=payout.id,
        tenant_id=payout.tenant_id,
        tenant_name=None,
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


def _normalize_input(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _map_provider_error_status_code(error: CryptoCashProviderError) -> int:
    return provider_error_http_status(error)
