import logging
from decimal import Decimal
from typing import Optional

from app.services.crypto_cash_rates_cache import get_crypto_cash_rates_cache

logger = logging.getLogger(__name__)


class ExchangeRateService:
    STABLECOIN_EQUIVALENTS = frozenset({"USD", "USDT", "USDC"})

    async def get_rate(self, currency: str, quote: str = "USD") -> Optional[Decimal]:
        currency = currency.upper()
        quote = quote.upper()

        if currency == quote:
            return Decimal("1")

        if quote not in self.STABLECOIN_EQUIVALENTS:
            return None

        if currency in self.STABLECOIN_EQUIVALENTS:
            return Decimal("1")

        manual_rate = await self._get_manual_rate(currency, quote)
        if manual_rate is not None:
            return manual_rate

        live_rate = get_crypto_cash_rates_cache().get_rate(currency)
        if live_rate is not None:
            return live_rate

        cached_rate = await self._get_cached_rate(currency, quote)
        if cached_rate is not None:
            return cached_rate

        snapshot = get_crypto_cash_rates_cache().refresh_sync()
        return snapshot.get(currency)

    async def _get_manual_rate(self, currency: str, quote: str) -> Optional[Decimal]:
        if quote not in {"USD", "USDT"}:
            return None
        try:
            from app.services.billing_policy_service import BillingPolicyService
            from app.db.session import AsyncSessionLocal

            async with AsyncSessionLocal() as session:
                manual_rates = await BillingPolicyService(session).get_manual_exchange_rates()
        except Exception:
            logger.exception("Failed to load manual exchange rates for %s/%s", currency, quote)
            return None

        return manual_rates.get(currency)

    async def _get_cached_rate(self, currency: str, quote: str) -> Optional[Decimal]:
        if quote not in {"USD", "USDT"}:
            return None
        try:
            from app.services.billing_policy_service import BillingPolicyService
            from app.db.session import AsyncSessionLocal

            async with AsyncSessionLocal() as session:
                cached_rates = await BillingPolicyService(session).get_cached_exchange_rates()
        except Exception:
            logger.exception("Failed to load cached exchange rates for %s/%s", currency, quote)
            return None

        return cached_rates.get(currency)

    def refresh_rates_for_symbols(self, symbols: list[str]) -> dict[str, Decimal]:
        cache = get_crypto_cash_rates_cache()
        snapshot = cache.get_snapshot()
        if not snapshot:
            snapshot = cache.refresh_sync()

        resolved: dict[str, Decimal] = {}
        seen: set[str] = set()
        for raw_symbol in symbols:
            symbol = raw_symbol.strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            if symbol in self.STABLECOIN_EQUIVALENTS:
                resolved[symbol] = Decimal("1")
                continue
            rate = snapshot.get(symbol)
            if rate is not None:
                resolved[symbol] = rate
            else:
                logger.warning("Crypto-Cash rate not found for symbol: %s", symbol)
        return resolved

    async def convert_to_fiat(
        self,
        amount: Decimal,
        from_currency: str,
        to_fiat: str = "USD",
        markup_percent: Decimal = Decimal("0"),
    ) -> Optional[Decimal]:
        rate = await self.get_rate(from_currency, to_fiat)
        if rate is None:
            return None
        adjusted_rate = rate * (Decimal("1") + markup_percent / Decimal("100"))
        if adjusted_rate <= 0:
            return None
        return (amount * adjusted_rate).quantize(Decimal("0.01"))

    async def convert_from_fiat(
        self,
        amount_fiat: Decimal,
        to_currency: str,
        from_fiat: str = "USD",
        markup_percent: Decimal = Decimal("0"),
    ) -> Optional[Decimal]:
        rate = await self.get_rate(to_currency, from_fiat)
        if rate is None:
            return None
        adjusted_rate = rate * (Decimal("1") + markup_percent / Decimal("100"))
        if adjusted_rate <= 0:
            return None
        return (amount_fiat / adjusted_rate).quantize(Decimal("0.00000001"))

    async def get_rates_for_symbols(
        self,
        symbols: list[str],
        quote: str = "USD",
    ) -> dict[str, Decimal]:
        resolved: dict[str, Decimal] = {}
        seen: set[str] = set()
        for raw_symbol in symbols:
            symbol = raw_symbol.strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            rate = await self.get_rate(symbol, quote)
            if rate is not None:
                resolved[symbol] = rate
        return resolved


def get_exchange_rate_service() -> ExchangeRateService:
    return ExchangeRateService()
