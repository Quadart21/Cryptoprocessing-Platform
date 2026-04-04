from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac import get_role_permissions, has_permission, is_platform_role
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.db.tenant import clear_db_security_context, set_db_security_context
from app.models.api_key import ApiKey
from app.models.project import Project
from app.models.tenant import Tenant
from app.models.user import User
from app.services.key_service import KeyService
from app.services.user_service import UserService

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class ClientAuthContext:
    tenant_id: str
    project_id: str | None
    user: User | None
    api_key_id: str | None
    auth_mode: str


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        clear_db_security_context()
        db.close()


def _resolve_user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization is required.",
        )

    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain subject.",
        )

    user = UserService(db).get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    if user.status not in {"active", "invited"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is suspended or inactive.",
        )
    return user


def _bind_user_security_context(db: Session, user: User) -> None:
    if user.role == "superadmin" or is_platform_role(user.role):
        set_db_security_context(db, tenant_id=None, is_superadmin=True)
        return
    set_db_security_context(db, tenant_id=user.tenant_id, is_superadmin=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    user = _resolve_user_from_credentials(credentials, db)
    _bind_user_security_context(db, user)
    return user


def get_client_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    x_api_secret: str | None = Header(default=None, alias="X-API-Secret"),
    db: Session = Depends(get_db),
) -> ClientAuthContext:
    # Bootstrap auth lookup under platform context, then switch to tenant context.
    set_db_security_context(db, tenant_id=None, is_superadmin=True)

    if credentials is not None:
        user = _resolve_user_from_credentials(credentials, db)
        if is_platform_role(user.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform role cannot use merchant client API.",
            )
        if user.tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not bound to tenant.",
            )
        tenant = db.get(Tenant, user.tenant_id)
        if tenant is None or tenant.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant must be approved before API access.",
            )
        set_db_security_context(db, tenant_id=user.tenant_id, is_superadmin=False)
        return ClientAuthContext(
            tenant_id=user.tenant_id,
            project_id=None,
            user=user,
            api_key_id=None,
            auth_mode="jwt",
        )

    if not x_api_key or not x_api_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Send Bearer token or X-API-Key/X-API-Secret pair.",
        )

    api_key = db.scalar(select(ApiKey).where(ApiKey.public_key == x_api_key))
    if api_key is None or api_key.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key not found or revoked.",
        )
    if api_key.secret_hash != KeyService.hash_secret(x_api_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API secret.",
        )

    project = db.get(Project, api_key.project_id)
    tenant = db.get(Tenant, api_key.tenant_id)
    if project is None or tenant is None or tenant.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project or tenant is unavailable.",
        )

    set_db_security_context(db, tenant_id=api_key.tenant_id, is_superadmin=False)
    return ClientAuthContext(
        tenant_id=api_key.tenant_id,
        project_id=api_key.project_id,
        user=None,
        api_key_id=api_key.id,
        auth_mode="api_key",
    )


def user_permissions(current_user: User) -> list[str]:
    return sorted(get_role_permissions(current_user.role))


def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin role required.",
        )
    return current_user


def require_platform_user(current_user: User = Depends(get_current_user)) -> User:
    if not is_platform_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform role required.",
        )
    return current_user


def require_platform_permission(permission: str):
    def dependency(current_user: User = Depends(require_platform_user)) -> User:
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}.",
            )
        return current_user

    return dependency


def require_any_platform_permission(*permissions: str):
    def dependency(current_user: User = Depends(require_platform_user)) -> User:
        if not any(has_permission(current_user.role, item) for item in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing permissions.",
            )
        return current_user

    return dependency


def require_tenant_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == "superadmin":
        return current_user

    if is_platform_role(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform role cannot use tenant cabinet.",
        )

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not bound to tenant.",
        )
    return current_user


def require_approved_tenant_user(
    current_user: User = Depends(require_tenant_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.role == "superadmin":
        return current_user
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not bound to tenant.",
        )
    tenant = db.get(Tenant, current_user.tenant_id)
    if tenant is None or tenant.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant must be approved before access.",
        )
    return current_user


def require_tenant_permission(permission: str):
    def dependency(current_user: User = Depends(require_approved_tenant_user)) -> User:
        if current_user.role == "superadmin":
            return current_user
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}.",
            )
        return current_user

    return dependency
