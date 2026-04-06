import base64
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.effective_jwt_secret, algorithm=ALGORITHM)


def create_refresh_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.refresh_token_expire_minutes)
    )
    payload = {"sub": subject, "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.effective_jwt_secret, algorithm=ALGORITHM)


def generate_invite_token() -> str:
    return token_urlsafe(32)


def encrypt_value(value: str) -> str:
    return _build_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    try:
        return _build_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Не удалось расшифровать защищенное значение.") from exc


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.effective_jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Недействительный токен.") from exc


def _build_fernet() -> Fernet:
    digest = sha256(settings.effective_fernet_secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)
