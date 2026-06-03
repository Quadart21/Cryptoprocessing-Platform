import logging
import threading
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Optional

import requests

from app.core.config import settings
from app.services.exchange_rate_price_field import (
    DEFAULT_EXCHANGE_RATE_PRICE_FIELD,
    EXCHANGE_RATE_PRICE_FIELD_TO_JSON_KEY,
    MARKET_RATE_QUOTE_CURRENCIES,
    MARKET_RATE_REQUIRED_PRICE_KEYS,
    normalize_exchange_rate_price_field,
)

logger = logging.getLogger(__name__)

_cache_instance: Optional["CryptoCashRatesCache"] = None
_cache_lock = threading.Lock()


@dataclass(frozen=True)
class MarketRatesSnapshot:
    rates: dict[str, Decimal]
    catalog_symbols: frozenset[str]


class CryptoCashRatesCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rates: dict[str, Decimal] = {}
        self._catalog_symbols: frozenset[str] = frozenset()
        self._price_field: str = DEFAULT_EXCHANGE_RATE_PRICE_FIELD
        self._last_success_at: float = 0.0
        self._poll_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def set_price_field(self, price_field: str) -> None:
        with self._lock:
            self._price_field = normalize_exchange_rate_price_field(price_field)

    def get_price_field(self) -> str:
        with self._lock:
            return self._price_field

    def start_polling(self) -> None:
        with self._lock:
            if self._poll_thread and self._poll_thread.is_alive():
                return
            self._stop_event.clear()
            self._poll_thread = threading.Thread(
                target=self._poll_loop,
                name="crypto-cash-rates-poller",
                daemon=True,
            )
            self._poll_thread.start()

    def stop_polling(self) -> None:
        self._stop_event.set()
        self._poll_thread = None

    def get_rate(self, symbol: str) -> Optional[Decimal]:
        normalized = symbol.strip().upper()
        if not normalized:
            return None
        with self._lock:
            return self._rates.get(normalized)

    def get_snapshot(self) -> dict[str, Decimal]:
        with self._lock:
            return dict(self._rates)

    def get_catalog_symbols(self) -> frozenset[str]:
        with self._lock:
            if self._catalog_symbols:
                return self._catalog_symbols
        self.refresh_sync()
        with self._lock:
            return self._catalog_symbols

    def refresh_sync(self) -> dict[str, Decimal]:
        try:
            snapshot = self._fetch_from_api()
        except Exception:
            logger.exception("Failed to refresh Crypto-Cash market rates")
            return self.get_snapshot()

        with self._lock:
            self._rates = snapshot.rates
            self._catalog_symbols = snapshot.catalog_symbols
            self._last_success_at = time.monotonic()
        return dict(snapshot.rates)

    def _poll_loop(self) -> None:
        interval = max(1, settings.exchange_rate_poll_interval_seconds)
        while True:
            self.refresh_sync()
            if self._stop_event.wait(interval):
                break

    def _fetch_from_api(self) -> MarketRatesSnapshot:
        with self._lock:
            price_field = self._price_field
        json_key = EXCHANGE_RATE_PRICE_FIELD_TO_JSON_KEY[price_field]

        response = requests.get(
            settings.crypto_cash_rates_export_url,
            timeout=settings.provider_http_connect_timeout_seconds,
            headers={"User-Agent": "cryptoprocessing/1.0"},
        )
        response.raise_for_status()
        payload = response.json()
        items = payload.get("rates") if isinstance(payload, dict) else None
        if not isinstance(items, list):
            raise ValueError("Crypto-Cash rates export returned invalid payload")

        resolved: dict[str, Decimal] = {}
        catalog_symbols: set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            quote = str(item.get("get") or "").upper()
            if quote not in MARKET_RATE_QUOTE_CURRENCIES:
                continue
            symbol = str(item.get("give") or "").upper()
            if not symbol:
                continue
            if self._has_complete_market_prices(item):
                catalog_symbols.add(symbol)
            raw_price = item.get(json_key)
            if raw_price in (None, ""):
                continue
            try:
                price = Decimal(str(raw_price))
            except (InvalidOperation, ValueError, TypeError):
                continue
            if price <= 0:
                continue
            resolved[symbol] = price

        if not resolved:
            raise ValueError(
                f"Crypto-Cash rates export returned no usable rates for price field {price_field}"
            )
        return MarketRatesSnapshot(
            rates=resolved,
            catalog_symbols=frozenset(catalog_symbols),
        )

    @staticmethod
    def _has_complete_market_prices(item: dict) -> bool:
        for key in MARKET_RATE_REQUIRED_PRICE_KEYS:
            raw_price = item.get(key)
            if raw_price in (None, ""):
                return False
            try:
                price = Decimal(str(raw_price))
            except (InvalidOperation, ValueError, TypeError):
                return False
            if price <= 0:
                return False
        return True


def get_crypto_cash_rates_cache() -> CryptoCashRatesCache:
    global _cache_instance
    if _cache_instance is None:
        with _cache_lock:
            if _cache_instance is None:
                _cache_instance = CryptoCashRatesCache()
    return _cache_instance
