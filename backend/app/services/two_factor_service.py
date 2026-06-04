from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decrypt_value, encrypt_value, verify_password
from app.models.user import User
from app.services.totp_service import TotpService


class TwoFactorError(Exception):
    pass


class TwoFactorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def get_status(self, user: User) -> dict[str, object]:
        return {
            "enabled": bool(user.totp_enabled),
            "configured": bool(user.totp_secret_encrypted),
            "confirmed_at": user.totp_confirmed_at,
        }

    async def setup(self, user: User) -> dict[str, object]:
        secret = TotpService.generate_secret()
        user.totp_secret_encrypted = encrypt_value(secret)
        user.totp_enabled = False
        user.totp_confirmed_at = None
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        issuer = (settings.app_name or "NorenDigital").strip()
        account_name = user.email.strip().lower()
        otpauth_url = TotpService.build_otpauth_url(
            secret=secret,
            account_name=account_name,
            issuer=issuer,
        )
        return {
            "enabled": False,
            "secret": secret,
            "issuer": issuer,
            "account_name": account_name,
            "otpauth_url": otpauth_url,
        }

    async def enable(self, user: User, code: str) -> User:
        if not user.totp_secret_encrypted:
            raise TwoFactorError("Сначала запустите настройку 2FA.")

        secret = self._decrypt_secret(user)
        if not TotpService.verify_code(secret=secret, code=code):
            raise TwoFactorError("Неверный код подтверждения 2FA.")

        user.totp_enabled = True
        user.totp_confirmed_at = datetime.now(timezone.utc)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def disable(self, user: User, *, password: str, code: str | None) -> User:
        if not verify_password(password, user.password_hash):
            raise TwoFactorError("Неверный пароль.")

        if user.totp_enabled and code:
            secret = self._decrypt_secret(user)
            if not TotpService.verify_code(secret=secret, code=code):
                raise TwoFactorError("Неверный код 2FA.")

        user.totp_enabled = False
        user.totp_secret_encrypted = None
        user.totp_confirmed_at = None
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    def verify_login_code(self, user: User, code: str | None) -> None:
        if not user.totp_enabled:
            return
        if not code:
            raise TwoFactorError("Для входа требуется код 2FA.")

        try:
            secret = self._decrypt_secret(user)
            if not TotpService.verify_code(secret=secret, code=code):
                raise TwoFactorError("Неверный код 2FA.")
        except TwoFactorError:
            raise
        except Exception:
            raise TwoFactorError("Ошибка проверки 2FA. Обратитесь к администратору.") from None

    @staticmethod
    def _decrypt_secret(user: User) -> str:
        if not user.totp_secret_encrypted:
            raise TwoFactorError("2FA не настроен для этого пользователя.")
        try:
            return decrypt_value(user.totp_secret_encrypted)
        except ValueError as exc:
            raise TwoFactorError("Ошибка чтения секрета 2FA.") from exc
