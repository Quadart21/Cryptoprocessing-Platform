import logging
import threading
import time
from decimal import Decimal, InvalidOperation
from typing import Optional

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_cache_instance: Optional["CryptoCashRatesCache"] = None
_cache_lock = threading.Lock()


class CryptoCashRatesCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rates: dict[str, Decimal] = {}
        self._last_success_at: float = 0.0
        self._poll_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def start_polling(self) -> None:
        with self._lock:
            if self._poll_thread and self._poll_thread.is_alive():
                return
            self._stop_event.clear()
            self.refresh_sync()
            self._poll_thread = threading.Thread(
                target=self._poll_loop,
                name="crypto-cash-rates-poller",
                daemon=True,
            )
            self._poll_thread.start()

    def stop_polling(self) -> None:
        self._stop_event.set()
        thread = self._poll_thread
        if thread and thread.is_alive():
            thread.join(timeout=5)
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

    def refresh_sync(self) -> dict[str, Decimal]:
        try:
            rates = self._fetch_from_api()
        except Exception:
            logger.exception("Failed to refresh Crypto-Cash market rates")
            return self.get_snapshot()

        with self._lock:
            self._rates = rates
            self._last_success_at = time.monotonic()
        return dict(rates)

    def _poll_loop(self) -> None:
        interval = max(1, settings.exchange_rate_poll_interval_seconds)
        while not self._stop_event.wait(interval):
            self.refresh_sync()

    def _fetch_from_api(self) -> dict[str, Decimal]:
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
        for item in items:
            if not isinstance(item, dict):
                continue
            quote = str(item.get("get") or "").upper()
            if quote not in {"USDT", "USD", "USDC"}:
                continue
            symbol = str(item.get("give") or "").upper()
            if not symbol:
                continue
            last_price = item.get("lastPrice")
            if last_price in (None, ""):
                continue
            try:
                price = Decimal(str(last_price))
            except (InvalidOperation, ValueError, TypeError):
                continue
            if price <= 0:
                continue
            resolved[symbol] = price

        if not resolved:
            raise ValueError("Crypto-Cash rates export returned no usable rates")
        return resolved


def get_crypto_cash_rates_cache() -> CryptoCashRatesCache:
    global _cache_instance
    if _cache_instance is None:
        with _cache_lock:
            if _cache_instance is None:
                _cache_instance = CryptoCashRatesCache()
    return _cache_instance
