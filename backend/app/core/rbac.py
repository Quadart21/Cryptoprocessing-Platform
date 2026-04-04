from __future__ import annotations

from dataclasses import dataclass


Permission = str


@dataclass(frozen=True)
class RoleDefinition:
    role: str
    scope: str
    label: str
    description: str
    permissions: tuple[Permission, ...]


PLATFORM_ROLES = {
    "superadmin",
    "platform_admin",
    "platform_finance",
    "platform_support",
}

TENANT_ROLES = {
    "tenant_owner",
    "tenant_manager",
    "tenant_accountant",
    "tenant_viewer",
}


PERMISSION_ADMIN_OVERVIEW_READ = "admin.overview.read"
PERMISSION_ADMIN_TENANTS_READ = "admin.tenants.read"
PERMISSION_ADMIN_TENANTS_WRITE = "admin.tenants.write"
PERMISSION_ADMIN_USERS_READ = "admin.users.read"
PERMISSION_ADMIN_USERS_WRITE = "admin.users.write"
PERMISSION_ADMIN_INVOICES_READ = "admin.invoices.read"
PERMISSION_ADMIN_INVOICES_WRITE = "admin.invoices.write"
PERMISSION_ADMIN_TRANSACTIONS_READ = "admin.transactions.read"
PERMISSION_ADMIN_EVENTS_READ = "admin.events.read"
PERMISSION_ADMIN_BILLING_READ = "admin.billing.read"
PERMISSION_ADMIN_BILLING_WRITE = "admin.billing.write"
PERMISSION_ADMIN_ASSETS_READ = "admin.assets.read"
PERMISSION_ADMIN_ASSETS_WRITE = "admin.assets.write"
PERMISSION_ADMIN_PAYOUTS_READ = "admin.payouts.read"
PERMISSION_ADMIN_PAYOUTS_WRITE = "admin.payouts.write"

PERMISSION_CLIENT_OVERVIEW_READ = "client.overview.read"
PERMISSION_CLIENT_PROJECTS_READ = "client.projects.read"
PERMISSION_CLIENT_PROJECTS_WRITE = "client.projects.write"
PERMISSION_CLIENT_API_KEYS_READ = "client.api_keys.read"
PERMISSION_CLIENT_API_KEYS_WRITE = "client.api_keys.write"
PERMISSION_CLIENT_WEBHOOKS_READ = "client.webhooks.read"
PERMISSION_CLIENT_WEBHOOKS_WRITE = "client.webhooks.write"
PERMISSION_CLIENT_INVOICES_READ = "client.invoices.read"
PERMISSION_CLIENT_INVOICES_WRITE = "client.invoices.write"
PERMISSION_CLIENT_TRANSACTIONS_READ = "client.transactions.read"
PERMISSION_CLIENT_BALANCE_READ = "client.balance.read"
PERMISSION_CLIENT_RATES_READ = "client.rates.read"
PERMISSION_CLIENT_ACCOUNTING_READ = "client.accounting.read"
PERMISSION_CLIENT_PAYOUTS_READ = "client.payouts.read"
PERMISSION_CLIENT_PAYOUTS_WRITE = "client.payouts.write"
PERMISSION_CLIENT_USERS_READ = "client.users.read"
PERMISSION_CLIENT_USERS_WRITE = "client.users.write"

PERMISSION_SECURITY_2FA_SELF = "security.2fa.self"


ALL_ADMIN_PERMISSIONS = {
    PERMISSION_ADMIN_OVERVIEW_READ,
    PERMISSION_ADMIN_TENANTS_READ,
    PERMISSION_ADMIN_TENANTS_WRITE,
    PERMISSION_ADMIN_USERS_READ,
    PERMISSION_ADMIN_USERS_WRITE,
    PERMISSION_ADMIN_INVOICES_READ,
    PERMISSION_ADMIN_INVOICES_WRITE,
    PERMISSION_ADMIN_TRANSACTIONS_READ,
    PERMISSION_ADMIN_EVENTS_READ,
    PERMISSION_ADMIN_BILLING_READ,
    PERMISSION_ADMIN_BILLING_WRITE,
    PERMISSION_ADMIN_ASSETS_READ,
    PERMISSION_ADMIN_ASSETS_WRITE,
    PERMISSION_ADMIN_PAYOUTS_READ,
    PERMISSION_ADMIN_PAYOUTS_WRITE,
}

ALL_CLIENT_PERMISSIONS = {
    PERMISSION_CLIENT_OVERVIEW_READ,
    PERMISSION_CLIENT_PROJECTS_READ,
    PERMISSION_CLIENT_PROJECTS_WRITE,
    PERMISSION_CLIENT_API_KEYS_READ,
    PERMISSION_CLIENT_API_KEYS_WRITE,
    PERMISSION_CLIENT_WEBHOOKS_READ,
    PERMISSION_CLIENT_WEBHOOKS_WRITE,
    PERMISSION_CLIENT_INVOICES_READ,
    PERMISSION_CLIENT_INVOICES_WRITE,
    PERMISSION_CLIENT_TRANSACTIONS_READ,
    PERMISSION_CLIENT_BALANCE_READ,
    PERMISSION_CLIENT_RATES_READ,
    PERMISSION_CLIENT_ACCOUNTING_READ,
    PERMISSION_CLIENT_PAYOUTS_READ,
    PERMISSION_CLIENT_PAYOUTS_WRITE,
    PERMISSION_CLIENT_USERS_READ,
    PERMISSION_CLIENT_USERS_WRITE,
}


ROLE_DEFINITIONS = {
    "superadmin": RoleDefinition(
        role="superadmin",
        scope="platform",
        label="Супер-админ",
        description="Полный доступ ко всем разделам платформы.",
        permissions=("*",),
    ),
    "platform_admin": RoleDefinition(
        role="platform_admin",
        scope="platform",
        label="Администратор платформы",
        description="Операционное управление платформой и клиентами.",
        permissions=tuple(sorted(ALL_ADMIN_PERMISSIONS | {PERMISSION_SECURITY_2FA_SELF})),
    ),
    "platform_finance": RoleDefinition(
        role="platform_finance",
        scope="platform",
        label="Финансы платформы",
        description="Доступ к бухгалтерии, выплатам и финансовым настройкам.",
        permissions=(
            PERMISSION_ADMIN_OVERVIEW_READ,
            PERMISSION_ADMIN_TENANTS_READ,
            PERMISSION_ADMIN_USERS_READ,
            PERMISSION_ADMIN_INVOICES_READ,
            PERMISSION_ADMIN_TRANSACTIONS_READ,
            PERMISSION_ADMIN_BILLING_READ,
            PERMISSION_ADMIN_BILLING_WRITE,
            PERMISSION_ADMIN_PAYOUTS_READ,
            PERMISSION_ADMIN_PAYOUTS_WRITE,
            PERMISSION_ADMIN_ASSETS_READ,
            PERMISSION_SECURITY_2FA_SELF,
        ),
    ),
    "platform_support": RoleDefinition(
        role="platform_support",
        scope="platform",
        label="Поддержка платформы",
        description="Чтение клиентов, инвойсов и событий без критичных изменений.",
        permissions=(
            PERMISSION_ADMIN_OVERVIEW_READ,
            PERMISSION_ADMIN_TENANTS_READ,
            PERMISSION_ADMIN_USERS_READ,
            PERMISSION_ADMIN_INVOICES_READ,
            PERMISSION_ADMIN_TRANSACTIONS_READ,
            PERMISSION_ADMIN_EVENTS_READ,
            PERMISSION_ADMIN_PAYOUTS_READ,
            PERMISSION_ADMIN_ASSETS_READ,
            PERMISSION_ADMIN_BILLING_READ,
            PERMISSION_SECURITY_2FA_SELF,
        ),
    ),
    "tenant_owner": RoleDefinition(
        role="tenant_owner",
        scope="tenant",
        label="Владелец клиента",
        description="Полный доступ в кабинете клиента в рамках своего tenant.",
        permissions=tuple(sorted(ALL_CLIENT_PERMISSIONS | {PERMISSION_SECURITY_2FA_SELF})),
    ),
    "tenant_manager": RoleDefinition(
        role="tenant_manager",
        scope="tenant",
        label="Менеджер клиента",
        description="Операционное управление проектами и инвойсами клиента.",
        permissions=(
            PERMISSION_CLIENT_OVERVIEW_READ,
            PERMISSION_CLIENT_PROJECTS_READ,
            PERMISSION_CLIENT_PROJECTS_WRITE,
            PERMISSION_CLIENT_API_KEYS_READ,
            PERMISSION_CLIENT_WEBHOOKS_READ,
            PERMISSION_CLIENT_WEBHOOKS_WRITE,
            PERMISSION_CLIENT_INVOICES_READ,
            PERMISSION_CLIENT_INVOICES_WRITE,
            PERMISSION_CLIENT_TRANSACTIONS_READ,
            PERMISSION_CLIENT_BALANCE_READ,
            PERMISSION_CLIENT_RATES_READ,
            PERMISSION_CLIENT_ACCOUNTING_READ,
            PERMISSION_CLIENT_PAYOUTS_READ,
            PERMISSION_CLIENT_PAYOUTS_WRITE,
            PERMISSION_CLIENT_USERS_READ,
            PERMISSION_CLIENT_USERS_WRITE,
            PERMISSION_SECURITY_2FA_SELF,
        ),
    ),
    "tenant_accountant": RoleDefinition(
        role="tenant_accountant",
        scope="tenant",
        label="Бухгалтер клиента",
        description="Финансовый доступ: транзакции, баланс и выплаты.",
        permissions=(
            PERMISSION_CLIENT_OVERVIEW_READ,
            PERMISSION_CLIENT_INVOICES_READ,
            PERMISSION_CLIENT_TRANSACTIONS_READ,
            PERMISSION_CLIENT_BALANCE_READ,
            PERMISSION_CLIENT_RATES_READ,
            PERMISSION_CLIENT_ACCOUNTING_READ,
            PERMISSION_CLIENT_PAYOUTS_READ,
            PERMISSION_CLIENT_PAYOUTS_WRITE,
            PERMISSION_CLIENT_USERS_READ,
            PERMISSION_SECURITY_2FA_SELF,
        ),
    ),
    "tenant_viewer": RoleDefinition(
        role="tenant_viewer",
        scope="tenant",
        label="Наблюдатель клиента",
        description="Только просмотр метрик и операций без изменений.",
        permissions=(
            PERMISSION_CLIENT_OVERVIEW_READ,
            PERMISSION_CLIENT_PROJECTS_READ,
            PERMISSION_CLIENT_API_KEYS_READ,
            PERMISSION_CLIENT_WEBHOOKS_READ,
            PERMISSION_CLIENT_INVOICES_READ,
            PERMISSION_CLIENT_TRANSACTIONS_READ,
            PERMISSION_CLIENT_BALANCE_READ,
            PERMISSION_CLIENT_RATES_READ,
            PERMISSION_CLIENT_ACCOUNTING_READ,
            PERMISSION_CLIENT_PAYOUTS_READ,
            PERMISSION_SECURITY_2FA_SELF,
        ),
    ),
}


def normalize_role(role: str) -> str:
    return role.strip().lower()


def is_platform_role(role: str) -> bool:
    return normalize_role(role) in PLATFORM_ROLES


def is_tenant_role(role: str) -> bool:
    return normalize_role(role) in TENANT_ROLES


def get_role_definition(role: str) -> RoleDefinition | None:
    return ROLE_DEFINITIONS.get(normalize_role(role))


def get_role_permissions(role: str) -> set[Permission]:
    definition = get_role_definition(role)
    if definition is None:
        return set()
    return set(definition.permissions)


def has_permission(role: str, permission: Permission) -> bool:
    permissions = get_role_permissions(role)
    return "*" in permissions or permission in permissions


def list_role_definitions(scope: str | None = None) -> list[RoleDefinition]:
    roles = list(ROLE_DEFINITIONS.values())
    if scope is not None:
        scope_value = scope.strip().lower()
        roles = [item for item in roles if item.scope == scope_value]
    return sorted(roles, key=lambda item: item.role)
