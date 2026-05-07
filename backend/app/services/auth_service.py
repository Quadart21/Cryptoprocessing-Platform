from datetime import datetime, timedelta, timezone
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_invite_token,
    get_password_hash,
    verify_password,
)
from app.models.invite_token import InviteToken
from app.models.user import User
from app.schemas.auth import TokenPairResponse
from app.services.session_service import SessionService
from app.services.two_factor_service import TwoFactorError, TwoFactorService


class AuthError(Exception):
    pass


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.session_service = SessionService(db)

    async def login(
        self,
        email: str,
        password: str,
        otp_code: str | None = None,
        device_fingerprint: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TokenPairResponse:
        normalized_email = email.strip().lower()
        user = await self.db.scalar(select(User).where(User.email == normalized_email))
        now = datetime.now(timezone.utc)

        if user is None:
            raise AuthError("Invalid email or password.")

        if user.login_locked_until and user.login_locked_until > now:
            locked_until = user.login_locked_until.astimezone(timezone.utc).isoformat()
            raise AuthError(f"Account is temporarily locked. Try again after {locked_until}.")

        if not verify_password(password, user.password_hash):
            await self._register_failed_login(user, now=now)
            raise AuthError("Invalid email or password.")

        if user.status != "active":
            raise AuthError("User is suspended or inactive.")

        try:
            TwoFactorService(self.db).verify_login_code(user, otp_code)
        except TwoFactorError as exc:
            await self._register_failed_login(user, now=now)
            raise AuthError(str(exc)) from exc

        user.last_login_at = now
        user.failed_login_attempts = 0
        user.last_failed_login_at = None
        user.login_locked_until = None
        self.db.add(user)
        await self.db.commit()

        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)

        await self.session_service.create_session(
            user=user,
            refresh_token=refresh_token,
            device_fingerprint=device_fingerprint,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def create_invite(self, user: User, ttl_hours: int = 24) -> str:
        raw_token = generate_invite_token()
        invite = InviteToken(
            user_id=user.id,
            token_hash=self._hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
        )
        self.db.add(invite)
        await self.db.commit()
        return raw_token

    async def set_password_by_invite(self, token: str, password: str) -> User:
        invite = await self.db.scalar(
            select(InviteToken).where(InviteToken.token_hash == self._hash_token(token))
        )
        if invite is None:
            raise AuthError("Invite token not found.")
        if invite.used_at is not None:
            raise AuthError("Invite token was already used.")
        if invite.expires_at < datetime.now(timezone.utc):
            raise AuthError("Invite token has expired.")

        user = await self.db.get(User, invite.user_id)
        if user is None:
            raise AuthError("Invite owner user not found.")

        user.password_hash = get_password_hash(password)
        user.status = "active"
        user.activated_at = datetime.now(timezone.utc)
        user.failed_login_attempts = 0
        user.last_failed_login_at = None
        user.login_locked_until = None
        invite.used_at = datetime.now(timezone.utc)
        self.db.add_all([user, invite])
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def change_password(self, user: User, *, current_password: str, new_password: str) -> User:
        if not verify_password(current_password, user.password_hash):
            raise AuthError("Invalid current password.")
        if verify_password(new_password, user.password_hash):
            raise AuthError("New password must differ from the current password.")

        user.password_hash = get_password_hash(new_password)
        user.failed_login_attempts = 0
        user.last_failed_login_at = None
        user.login_locked_until = None
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def _register_failed_login(self, user: User, *, now: datetime) -> None:
        attempts = max(int(user.failed_login_attempts or 0), 0) + 1
        user.failed_login_attempts = attempts
        user.last_failed_login_at = now
        if attempts >= settings.auth_lockout_threshold:
            user.login_locked_until = now + timedelta(minutes=settings.auth_lockout_minutes)
            user.failed_login_attempts = 0
        self.db.add(user)
        await self.db.commit()

    @staticmethod
    def _hash_token(token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    def get_invite_token_hash(self, token: str) -> str:
        return self._hash_token(token)
