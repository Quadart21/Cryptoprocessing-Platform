from datetime import datetime, timedelta, timezone
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.user_session import UserSession


class SessionService:
    def __init__(self, db: Session):
        self.db = db

    def create_session(
        self,
        user: User,
        refresh_token: str,
        device_fingerprint: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> UserSession:
        self._cleanup_old_sessions(user.id)
        self._enforce_max_sessions(user.id)

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.refresh_token_expire_minutes)

        session = UserSession(
            user_id=user.id,
            device_fingerprint=device_fingerprint,
            ip_address=ip_address,
            user_agent=user_agent,
            refresh_token_hash=self._hash_token(refresh_token),
            expires_at=expires_at,
            last_used_at=now,
        )
        self.db.add(session)
        self.db.commit()
        return session

    def verify_session(self, user_id: str, refresh_token: str) -> UserSession | None:
        token_hash = self._hash_token(refresh_token)
        now = datetime.now(timezone.utc)

        session = self.db.scalar(
            select(UserSession).where(
                UserSession.user_id == user_id,
                UserSession.refresh_token_hash == token_hash,
                UserSession.is_revoked == False,
                UserSession.expires_at > now,
            )
        )
        if session is None:
            return None

        session.last_used_at = now
        self.db.add(session)
        self.db.commit()
        return session

    def revoke_session(self, user_id: str, session_id: str) -> bool:
        session = self.db.scalar(
            select(UserSession).where(
                UserSession.id == session_id,
                UserSession.user_id == user_id,
            )
        )
        if session is None:
            return False

        session.is_revoked = True
        session.revoked_at = datetime.now(timezone.utc)
        session.revoke_reason = "user_requested"
        self.db.add(session)
        self.db.commit()
        return True

    def revoke_all_user_sessions(self, user_id: str, reason: str = "security_reset") -> int:
        now = datetime.now(timezone.utc)
        sessions = list(
            self.db.scalars(
                select(UserSession).where(
                    UserSession.user_id == user_id,
                    UserSession.is_revoked == False,
                )
            )
        )
        count = 0
        for session in sessions:
            session.is_revoked = True
            session.revoked_at = now
            session.revoke_reason = reason
            self.db.add(session)
            count += 1
        if sessions:
            self.db.commit()
        return count

    def list_user_sessions(self, user_id: str) -> list[UserSession]:
        now = datetime.now(timezone.utc)
        return list(
            self.db.scalars(
                select(UserSession)
                .where(
                    UserSession.user_id == user_id,
                    UserSession.is_revoked == False,
                    UserSession.expires_at > now,
                )
                .order_by(UserSession.last_used_at.desc())
            )
        )

    def _cleanup_old_sessions(self, user_id: str) -> None:
        now = datetime.now(timezone.utc)
        old_sessions = list(
            self.db.scalars(
                select(UserSession).where(
                    UserSession.user_id == user_id,
                    UserSession.expires_at <= now,
                )
            )
        )
        for session in old_sessions:
            session.is_revoked = True
            self.db.add(session)
        if old_sessions:
            self.db.commit()

    def _enforce_max_sessions(self, user_id: str) -> None:
        now = datetime.now(timezone.utc)
        active_sessions = list(
            self.db.scalars(
                select(UserSession).where(
                    UserSession.user_id == user_id,
                    UserSession.is_revoked == False,
                    UserSession.expires_at > now,
                )
            )
        )
        if len(active_sessions) >= settings.max_concurrent_sessions_per_user:
            oldest = min(active_sessions, key=lambda s: s.last_used_at)
            oldest.is_revoked = True
            oldest.revoked_at = datetime.now(timezone.utc)
            oldest.revoke_reason = "max_sessions_exceeded"
            self.db.add(oldest)
            self.db.commit()

    @staticmethod
    def _hash_token(token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()
