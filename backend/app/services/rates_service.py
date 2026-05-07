from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.asset_availability import AssetAvailability
from app.providers.factory import get_payment_provider
from app.schemas.rates import RateItemResponse, RateNetworkResponse, RatesResponse
from app.services.cache_service import get_cache_service


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
    RATES_CACHE_KEY = "rates:all:v1"
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
        response = provider.list_currencies()
        items = response.get("data", {}).get("items", [])
        overrides = await self._load_platform_overrides()
        mapped_items: list[RateItemResponse] = []

        for item in items:
            currency = str(item.get("currency") or "").upper()
            if not currency:
                continue
            limits_by_network = {
                str(limit.get("network") or "").upper(): limit
                for limit in item.get("limits", [])
                if limit
            }
            networks: list[RateNetworkResponse] = []
            for network in item.get("networks", []) or []:
                network_name = str(network.get("name") or "").upper()
                if not network_name:
                    continue
                limit = limits_by_network.get(network_name, {})
                provider_availability = bool(limit.get("availability", True))
                acquiring = bool(limit.get("acquiring", True))
                platform_enabled = overrides.get((currency, network_name), True)
                client_available = provider_availability and platform_enabled and acquiring
                availability_reason = self._resolve_availability_reason(
                    platform_enabled=platform_enabled,
                    provider_availability=provider_availability,
                    acquiring=acquiring,
                )
                networks.append(
                    RateNetworkResponse(
                        network=network_name,
                        ticker=self._pick_first(limit, "ticker"),
                        min_deposit=self._pick_first(limit, *self.MIN_DEPOSIT_KEYS),
                        max_deposit=self._pick_first(limit, *self.MAX_DEPOSIT_KEYS),
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
                        memo_required=bool(network.get("isMemoRequired", False)),
                    )
                )
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
            raise ValueError("Токен или сеть не найдены в списке провайдера.")

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
        rule = await self.db.scalar(
            select(AssetAvailability).where(
                AssetAvailability.currency == normalized_currency,
                AssetAvailability.network == normalized_network,
            )
        )
        if rule is not None and not rule.is_enabled:
            raise ValueError("Выбранные токен и сеть отключены администратором платформы.")

    async def get_client_payin_limits(self, *, currency: str, network: str) -> PayInLimits:
        normalized_currency, normalized_network = self._normalize_pair(currency, network)
        response = get_payment_provider().list_currencies()
        items = response.get("data", {}).get("items", [])
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
                f"Пара {normalized_currency}/{normalized_network} не найдена у провайдера."
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
                f"Сеть {normalized_network} для {normalized_currency} не поддерживается провайдером."
            )

        provider_availability = bool(limit.get("availability", True))
        acquiring = bool(limit.get("acquiring", True))
        platform_enabled = overrides.get((normalized_currency, normalized_network), True)
        if not platform_enabled:
            raise ValueError("Выбранные токен и сеть отключены администратором платформы.")
        if not provider_availability:
            raise ValueError("Провайдер временно отключил этот токен/сеть.")
        if not acquiring:
            raise ValueError("Пополнение по этому токену/сети временно недоступно у провайдера.")

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
        items = response.get("data", {}).get("items", [])
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
    def _normalize_pair(currency: str, network: str) -> tuple[str, str]:
        normalized_currency = currency.strip().upper()
        normalized_network = network.strip().upper()
        if not normalized_currency or not normalized_network:
            raise ValueError("Валюту и сеть нужно заполнить.")
        return normalized_currency, normalized_network

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
