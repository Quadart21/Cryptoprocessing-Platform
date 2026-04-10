import logging
from decimal import Decimal, InvalidOperation
from typing import Optional

import requests

from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


class ExchangeRateService:
    BASE_URL = "https://api.coinlore.net/api"
    PAGE_LIMIT = 100
    MAX_PAGES = 200

    def get_rate(self, currency: str, quote: str = "USD") -> Optional[Decimal]:
        currency = currency.upper()
        quote = quote.upper()

        if currency == quote:
            return Decimal("1")

        if quote not in {"USD", "USDT"}:
            return None

        manual_rate = self._get_manual_rate(currency, quote)
        if manual_rate is not None:
            return manual_rate

        return self._get_cached_rate(currency, quote)

    def _get_manual_rate(self, currency: str, quote: str) -> Optional[Decimal]:
        if quote not in {"USD", "USDT"}:
            return None
        try:
            from app.services.billing_policy_service import BillingPolicyService

            with SessionLocal() as session:
                manual_rates = BillingPolicyService(session).get_manual_exchange_rates()
        except Exception:
            logger.exception("Failed to load manual exchange rates for %s/%s", currency, quote)
            return None

        return manual_rates.get(currency)

    def _get_cached_rate(self, currency: str, quote: str) -> Optional[Decimal]:
        if quote not in {"USD", "USDT"}:
            return None
        try:
            from app.services.billing_policy_service import BillingPolicyService

            with SessionLocal() as session:
                cached_rates = BillingPolicyService(session).get_cached_exchange_rates()
        except Exception:
            logger.exception("Failed to load cached exchange rates for %s/%s", currency, quote)
            return None

        return cached_rates.get(currency)

    def _fetch_rate(self, currency: str) -> Optional[Decimal]:
        if currency == "USD":
            return Decimal("1")
        if currency == "USDT":
            return Decimal("1")

        session = requests.Session()
        for page in range(self.MAX_PAGES):
            start = page * self.PAGE_LIMIT
            response = session.get(
                f"{self.BASE_URL}/tickers/",
                params={"start": start, "limit": self.PAGE_LIMIT},
                timeout=10,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
            )
            response.raise_for_status()
            payload = response.json()
            items = payload.get("data", [])
            if not items:
                break

            for item in items:
                symbol = str(item.get("symbol") or "").upper()
                if symbol != currency:
                    continue
                price_usd = item.get("price_usd")
                if price_usd in (None, ""):
                    return None
                try:
                    return Decimal(str(price_usd))
                except (InvalidOperation, ValueError, TypeError):
                    return None

            if len(items) < self.PAGE_LIMIT:
                break

        logger.warning("CoinLore symbol not found: %s", currency)
        return None

    def refresh_rates_for_symbols(self, symbols: list[str]) -> dict[str, Decimal]:
        resolved: dict[str, Decimal] = {}
        seen: set[str] = set()
        for raw_symbol in symbols:
            symbol = raw_symbol.strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            try:
                rate = self._fetch_rate(symbol)
            except Exception as exc:
                logger.error("Failed to refresh live rate for %s: %s", symbol, exc)
                continue
            if rate is not None:
                resolved[symbol] = rate
        return resolved

    def convert_to_fiat(
        self,
        amount: Decimal,
        from_currency: str,
        to_fiat: str = "USD",
        markup_percent: Decimal = Decimal("0"),
    ) -> Optional[Decimal]:
        rate = self.get_rate(from_currency, to_fiat)
        if rate is None:
            return None
        adjusted_rate = rate * (Decimal("1") + markup_percent / Decimal("100"))
        if adjusted_rate <= 0:
            return None
        return (amount * adjusted_rate).quantize(Decimal("0.01"))

    def convert_from_fiat(
        self,
        amount_fiat: Decimal,
        to_currency: str,
        from_fiat: str = "USD",
        markup_percent: Decimal = Decimal("0"),
    ) -> Optional[Decimal]:
        rate = self.get_rate(to_currency, from_fiat)
        if rate is None:
            return None
        adjusted_rate = rate * (Decimal("1") + markup_percent / Decimal("100"))
        if adjusted_rate <= 0:
            return None
        return (amount_fiat / adjusted_rate).quantize(Decimal("0.00000001"))

    def get_rates_for_symbols(
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
            rate = self.get_rate(symbol, quote)
            if rate is not None:
                resolved[symbol] = rate
        return resolved


def get_exchange_rate_service() -> ExchangeRateService:
    return ExchangeRateService()
