from hashlib import sha256
from secrets import token_urlsafe


class KeyService:
    @staticmethod
    def generate_public_key() -> str:
        return f"pk_live_{token_urlsafe(18)}"

    @staticmethod
    def generate_secret_key() -> str:
        return f"sk_live_{token_urlsafe(32)}"

    @staticmethod
    def hash_secret(secret: str) -> str:
        return sha256(secret.encode("utf-8")).hexdigest()

