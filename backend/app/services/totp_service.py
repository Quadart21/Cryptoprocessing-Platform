from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from urllib.parse import quote


class TotpService:
    DIGITS = 6
    PERIOD_SECONDS = 30

    @classmethod
    def generate_secret(cls) -> str:
        # 20 bytes -> 32 chars base32 secret (Google Authenticator compatible)
        raw = secrets.token_bytes(20)
        return base64.b32encode(raw).decode("ascii").rstrip("=")

    @classmethod
    def build_otpauth_url(cls, *, secret: str, account_name: str, issuer: str) -> str:
        label = quote(f"{issuer}:{account_name}")
        issuer_encoded = quote(issuer)
        return (
            f"otpauth://totp/{label}"
            f"?secret={secret}&issuer={issuer_encoded}"
            f"&digits={cls.DIGITS}&period={cls.PERIOD_SECONDS}"
        )

    @classmethod
    def verify_code(cls, *, secret: str, code: str, window: int = 1) -> bool:
        normalized_code = "".join(char for char in code if char.isdigit())
        if len(normalized_code) != cls.DIGITS:
            return False

        counter = int(time.time() // cls.PERIOD_SECONDS)
        for drift in range(-window, window + 1):
            expected = cls._hotp(secret=secret, counter=counter + drift)
            if hmac.compare_digest(expected, normalized_code):
                return True
        return False

    @classmethod
    def _hotp(cls, *, secret: str, counter: int) -> str:
        key = base64.b32decode(cls._normalize_secret(secret), casefold=True)
        payload = counter.to_bytes(8, byteorder="big", signed=False)
        digest = hmac.new(key, payload, hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        truncated = digest[offset : offset + 4]
        code_int = int.from_bytes(truncated, byteorder="big") & 0x7FFFFFFF
        code = code_int % (10**cls.DIGITS)
        return f"{code:0{cls.DIGITS}d}"

    @staticmethod
    def _normalize_secret(secret: str) -> str:
        compact = secret.strip().replace(" ", "").upper()
        padding = (-len(compact)) % 8
        return compact + ("=" * padding)
