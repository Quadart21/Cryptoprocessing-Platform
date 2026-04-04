from functools import lru_cache

from app.core.config import settings
from app.providers.base import PaymentProviderInterface
from app.providers.crypto_cash import CryptoCashProvider
from app.providers.crypto_cash_mock import CryptoCashMockProvider


@lru_cache(maxsize=1)
def get_payment_provider() -> PaymentProviderInterface:
    if settings.payment_provider == "crypto_cash":
        return CryptoCashProvider()
    return CryptoCashMockProvider()
