import asyncio
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.asset_availability import AssetAvailability
from app.providers.factory import get_payment_provider
from app.schemas.rates import RateItemResponse, RateNetworkResponse, RatesResponse
from app.services.cache_service import get_cache_service
from app.services.crypto_cash_rates_cache import get_crypto_cash_rates_cache
from app.services.exchange_rate_service import ExchangeRateService, get_exchange_rate_service


@dataclass(frozen=True)
class PayInLimits:
    currency: str
    network: str
    min_amount: Decimal | None
    max_amount: Decimal | None
    provider_availability: bool
    acquiring: bool
    platform_enabled: bool


class RatesService:
    RATES_CACHE_KEY = "rates:all:v5"
    RATES_CACHE_PREFIX = "rates:"
    MIN_DEPOSIT_KEYS = (
        "min_deposit",
        "min",
        "min_amount",
        "minAmount",
        "min_payin",
        "minPayin",
    )
    MAX_DEPOSIT_KEYS = (
        "max_deposit",
        "max",
        "max_amount",
        "maxAmount",
        "max_payin",
        "maxPayin",
    )
    MIN_WITHDRAW_KEYS = ("min_withdraw", "minWithdraw")
    MAX_WITHDRAW_KEYS = ("max_withdraw", "maxWithdraw")
    NETWORK_FEE_KEYS = ("network_fee", "fee", "networkFee")
    NETWORK_CONFIRM_KEYS = ("networkConfirm", "network_confirm", "confirmations", "confirm")

    def __init__(self, db: AsyncSession | None = None):
        self.db = db

    async def list_rates(self) -> RatesResponse:
        cache = get_cache_service()
        cached = cache.get_json(self.RATES_CACHE_KEY)
        if isinstance(cached, dict):
            try:
                return RatesResponse.model_validate(cached)
            except Exception:
                cache.delete(self.RATES_CACHE_KEY)

        provider = get_payment_provider()
        response = await asyncio.to_thread(provider.list_currencies)
        items = self._extract_provider_items(response)
        overrides = await self._load_platform_overrides()
        rate_service = get_exchange_rate_service()
        catalog_symbols = await asyncio.to_thread(get_crypto_cash_rates_cache().get_catalog_symbols)
        currencies: set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            currency_name = str(item.get("currency") or item.get("ticker") or "").upper()
            if currency_name and self._is_allowed_client_currency(currency_name, catalog_symbols):
                currencies.add(currency_name)
        fiat_rates = await rate_service.get_rates_for_symbols(sorted(currencies), "USD")
        mapped_items: list[RateItemResponse] = []

        for item in items:
            if not isinstance(item, dict):
                continue
            currency = str(item.get("currency") or item.get("ticker") or "").upper()
            if not currency or not self._is_allowed_client_currency(currency, catalog_symbols):
                continue
            limits_by_network = {
                network_name: limit
                for limit in item.get("limits", []) or []
                if isinstance(limit, dict)
                for network_name in [self._normalize_network_name(limit.get("network"))]
                if network_name
            }
            networks: list[RateNetworkResponse] = []
            for network in item.get("networks", []) or []:
                network_name = self._normalize_network_name(network)
                if not network_name:
                    continue
                limit = limits_by_network.get(network_name, {})
                if not isinstance(limit, dict):
                    limit = {}
                network_meta = network if isinstance(network, dict) else {}
                provider_availability = bool(limit.get("availability", True))
                acquiring = bool(limit.get("acquiring", True))
                platform_enabled = overrides.get((currency, network_name), True)
                client_available = provider_availability and platform_enabled and acquiring
                availability_reason = self._resolve_availability_reason(
                    platform_enabled=platform_enabled,
                    provider_availability=provider_availability,
                    acquiring=acquiring,
                )
                min_deposit = self._pick_first(limit, *self.MIN_DEPOSIT_KEYS)
                max_deposit = self._pick_first(limit, *self.MAX_DEPOSIT_KEYS)
                min_deposit_fiat = self._deposit_limit_to_fiat_sync(
                    amount=min_deposit,
                    currency=currency,
                    fiat_rates=fiat_rates,
                    stablecoins=rate_service.STABLECOIN_EQUIVALENTS,
                )
                max_deposit_fiat = self._deposit_limit_to_fiat_sync(
                    amount=max_deposit,
                    currency=currency,
                    fiat_rates=fiat_rates,
                    stablecoins=rate_service.STABLECOIN_EQUIVALENTS,
                )
                networks.append(
                    RateNetworkResponse(
                        network=network_name,
                        ticker=self._pick_first(limit, "ticker"),
                        min_deposit=min_deposit,
                        max_deposit=max_deposit,
                        min_deposit_fiat=min_deposit_fiat,
                        max_deposit_fiat=max_deposit_fiat,
                        min_withdraw=self._pick_first(limit, *self.MIN_WITHDRAW_KEYS),
                        max_withdraw=self._pick_first(limit, *self.MAX_WITHDRAW_KEYS),
                        network_fee=self._pick_first(limit, *self.NETWORK_FEE_KEYS),
                        availability=client_available,
                        provider_availability=provider_availability,
                        platform_enabled=platform_enabled,
                        client_available=client_available,
                        availability_reason=availability_reason,
                        acquiring=acquiring,
                        withdrawal=bool(limit.get("withdrawal", True)),
                        memo_required=bool(
                            network_meta.get("isMemoRequired", network_meta.get("memoRequired", False))
                        ),
                    )
                )
            if networks:
                mapped_items.append(RateItemResponse(currency=currency, networks=networks))

        payload = RatesResponse(items=mapped_items)
        cache.set_json(
            self.RATES_CACHE_KEY,
            payload.model_dump(mode="json"),
            ttl_seconds=settings.cache_rates_ttl_seconds,
        )
        return payload

    async def set_platform_asset_enabled(
        self,
        *,
        currency: str,
        network: str,
        platform_enabled: bool,
    ) -> tuple[str, str, bool]:
        if self.db is None:
            raise ValueError("DB session is required for asset availability updates.")

        normalized_currency, normalized_network = self._normalize_pair(currency, network)
        if not self._asset_exists_on_provider(normalized_currency, normalized_network):
            raise ValueError("Token or network was not found in the provider list.")

        rule = await self.db.scalar(
            select(AssetAvailability).where(
                AssetAvailability.currency == normalized_currency,
                AssetAvailability.network == normalized_network,
            )
        )
        if rule is None:
            rule = AssetAvailability(
                currency=normalized_currency,
                network=normalized_network,
                is_enabled=platform_enabled,
            )
            self.db.add(rule)
        else:
            rule.is_enabled = platform_enabled
            self.db.add(rule)

        await self.db.commit()
        self._invalidate_rates_cache()
        return normalized_currency, normalized_network, platform_enabled

    async def assert_asset_enabled_for_client(self, *, currency: str, network: str) -> None:
        if self.db is None:
            return
        normalized_currency, normalized_network = self._normalize_pair(currency, network)
        self._assert_market_rate_catalog_currency(normalized_currency)
        rule = await self.db.scalar(
            select(AssetAvailability).where(
                AssetAvailability.currency == normalized_currency,
                AssetAvailability.network == normalized_network,
            )
        )
        if rule is not None and not rule.is_enabled:
            raise ValueError("Selected token and network are disabled by the platform administrator.")

    async def get_client_payin_limits(self, *, currency: str, network: str) -> PayInLimits:
        normalized_currency, normalized_network = self._normalize_pair(currency, network)
        self._assert_market_rate_catalog_currency(normalized_currency)
        response = get_payment_provider().list_currencies()
        items = self._extract_provider_items(response)
        overrides = await self._load_platform_overrides()

        target_item = next(
            (
                item
                for item in items
                if str(item.get("currency") or "").upper() == normalized_currency
            ),
            None,
        )
        if target_item is None:
            raise ValueError(
                f"Pair {normalized_currency}/{normalized_network} was not found at the provider."
            )

        limits = target_item.get("limits", []) or []
        limit = next(
            (
                candidate
                for candidate in limits
                if str(candidate.get("network") or "").upper() == normalized_network
            ),
            None,
        )
        if limit is None:
            raise ValueError(
                f"Network {normalized_network} for {normalized_currency} is not supported by the provider."
            )

        provider_availability = bool(limit.get("availability", True))
        acquiring = bool(limit.get("acquiring", True))
        platform_enabled = overrides.get((normalized_currency, normalized_network), True)
        if not platform_enabled:
            raise ValueError("Selected token and network are disabled by the platform administrator.")
        if not provider_availability:
            raise ValueError("Provider has temporarily disabled this token/network.")
        if not acquiring:
            raise ValueError("Deposits for this token/network are temporarily unavailable at the provider.")

        min_amount = self._pick_decimal(limit, *self.MIN_DEPOSIT_KEYS)
        max_amount = self._pick_decimal(limit, *self.MAX_DEPOSIT_KEYS)
        return PayInLimits(
            currency=normalized_currency,
            network=normalized_network,
            min_amount=min_amount,
            max_amount=max_amount,
            provider_availability=provider_availability,
            acquiring=acquiring,
            platform_enabled=platform_enabled,
        )

    async def get_network_confirmations_required(self, *, currency: str, network: str) -> int | None:
        normalized_currency, normalized_network = self._normalize_pair(currency, network)
        provider = get_payment_provider()
        response = await asyncio.to_thread(provider.list_currencies)
        items = self._extract_provider_items(response)
        target_item = next(
            (
                item
                for item in items
                if str(item.get("currency") or "").upper() == normalized_currency
            ),
            None,
        )
        if target_item is None:
            raise ValueError(
                f"Pair {normalized_currency}/{normalized_network} was not found at the provider."
            )

        limits = target_item.get("limits", []) or []
        limit = next(
            (
                candidate
                for candidate in limits
                if str(candidate.get("network") or "").upper() == normalized_network
            ),
            None,
        )
        if limit is None:
            raise ValueError(
                f"Network {normalized_network} for {normalized_currency} is not supported by the provider."
            )

        value = self._pick_first(limit, *self.NETWORK_CONFIRM_KEYS)
        if value in (None, ""):
            return None
        try:
            parsed = int(str(value).strip())
        except ValueError:
            return None
        return parsed if parsed > 0 else None

    async def _load_platform_overrides(self) -> dict[tuple[str, str], bool]:
        if self.db is None:
            return {}
        rows = list((await self.db.scalars(select(AssetAvailability))).all())
        return {(row.currency.upper(), row.network.upper()): bool(row.is_enabled) for row in rows}

    @staticmethod
    def _invalidate_rates_cache() -> None:
        get_cache_service().delete_by_prefix(RatesService.RATES_CACHE_PREFIX)

    def _asset_exists_on_provider(self, currency: str, network: str) -> bool:
        provider = get_payment_provider()
        response = provider.list_currencies()
        items = self._extract_provider_items(response)
        for item in items:
            item_currency = str(item.get("currency") or "").upper()
            if item_currency != currency:
                continue
            for candidate_network in item.get("networks", []) or []:
                network_name = str(candidate_network.get("name") or "").upper()
                if network_name == network:
                    return True
        return False

    @staticmethod
    def _extract_provider_items(response: dict[str, Any]) -> list[Any]:
        data = response.get("data")
        if isinstance(data, dict):
            items = data.get("items", [])
            return items if isinstance(items, list) else []
        if isinstance(data, list):
            return data
        return []

    @staticmethod
    def _normalize_network_name(network: Any) -> str | None:
        if isinstance(network, str):
            text = network.strip()
            return text.upper() if text else None
        if isinstance(network, dict):
            for key in ("name", "network", "code"):
                value = network.get(key)
                if value is None:
                    continue
                text = str(value).strip()
                if text:
                    return text.upper()
        return None

    @staticmethod
    def _normalize_pair(currency: str, network: str) -> tuple[str, str]:
        normalized_currency = currency.strip().upper()
        normalized_network = network.strip().upper()
        if not normalized_currency or not normalized_network:
            raise ValueError("Currency and network are required.")
        return normalized_currency, normalized_network

    @staticmethod
    def _deposit_limit_to_fiat_sync(
        *,
        amount: str | None,
        currency: str,
        fiat_rates: dict[str, Decimal],
        stablecoins: frozenset[str],
    ) -> str | None:
        if not amount:
            return None
        parsed = RatesService._pick_decimal({"value": amount}, "value")
        if parsed is None or parsed <= Decimal("0"):
            return None
        normalized_currency = currency.strip().upper()
        if normalized_currency in stablecoins:
            return format(parsed.normalize(), "f")
        rate = fiat_rates.get(normalized_currency)
        if rate is None:
            return None
        converted = (parsed * rate).quantize(Decimal("0.01"))
        return format(converted.normalize(), "f")

    @staticmethod
    def _pick_first(source: dict, *keys: str) -> str | None:
        for key in keys:
            value = source.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return None

    @staticmethod
    def _pick_decimal(source: dict, *keys: str) -> Decimal | None:
        value = RatesService._pick_first(source, *keys)
        if value is None:
            return None
        normalized = value.replace(",", ".").strip()
        try:
            parsed = Decimal(normalized)
        except InvalidOperation:
            return None
        if parsed < Decimal("0"):
            return None
        return parsed

    @staticmethod
    def _is_allowed_client_currency(currency: str, catalog_symbols: frozenset[str]) -> bool:
        normalized_currency = currency.strip().upper()
        if normalized_currency in ExchangeRateService.STABLECOIN_EQUIVALENTS:
            return True
        if not catalog_symbols:
            return False
        return normalized_currency in catalog_symbols

    @staticmethod
    def _assert_market_rate_catalog_currency(currency: str) -> None:
        catalog_symbols = get_crypto_cash_rates_cache().get_catalog_symbols()
        if RatesService._is_allowed_client_currency(currency, catalog_symbols):
            return
        normalized_currency = currency.strip().upper()
        raise ValueError(f"Token {normalized_currency} is not available for payment.")

    @staticmethod
    def _resolve_availability_reason(
        *,
        platform_enabled: bool,
        provider_availability: bool,
        acquiring: bool,
    ) -> str:
        if not platform_enabled:
            return "disabled_by_platform"
        if not provider_availability:
            return "disabled_by_provider"
        if not acquiring:
            return "acquiring_off"
        return "available"
