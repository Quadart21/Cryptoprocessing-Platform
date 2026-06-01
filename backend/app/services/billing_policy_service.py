import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_value, encrypt_value
from app.models.platform_setting import PlatformSetting
from app.models.tenant_fee_policy import TenantFeePolicy

logger = logging.getLogger(__name__)


class BillingPolicyService:
    DEFAULT_CODE = "default"

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_platform_settings(self) -> PlatformSetting:
        settings = await self.db.scalar(
            select(PlatformSetting).where(PlatformSetting.code == self.DEFAULT_CODE)
        )
        if settings is None:
            settings = PlatformSetting(code=self.DEFAULT_CODE)
            self.db.add(settings)
            await self.db.flush()
        return settings

    async def sandbox_cloudflare_token_configured(self) -> bool:
        ps = await self.get_platform_settings()
        return bool(ps.sandbox_cloudflare_api_token_encrypted)

    async def get_decrypted_sandbox_cloudflare_token(self) -> str | None:
        ps = await self.get_platform_settings()
        raw = ps.sandbox_cloudflare_api_token_encrypted
        if not raw:
            return None
        try:
            return decrypt_value(raw)
        except ValueError:
            logger.exception("Не удалось расшифровать sandbox Cloudflare token.")
            return None

    async def set_sandbox_cloudflare_api_token(self, token: str | None) -> PlatformSetting:
        ps = await self.get_platform_settings()
        stripped = (token or "").strip()
        if stripped:
            ps.sandbox_cloudflare_api_token_encrypted = encrypt_value(stripped)
        else:
            ps.sandbox_cloudflare_api_token_encrypted = None
        self.db.add(ps)
        await self.db.commit()
        await self.db.refresh(ps)
        return ps

    async def describe_sandbox_cloudflare_token_for_admin(self) -> tuple[bool, str | None]:
        """Возвращает (настроен ли токен, маску вида ****abcd для отображения в UI)."""
        ps = await self.get_platform_settings()
        raw = ps.sandbox_cloudflare_api_token_encrypted
        if not raw:
            return False, None
        try:
            plain = decrypt_value(raw)
        except ValueError:
            logger.exception("Не удалось расшифровать sandbox Cloudflare token для маски.")
            return True, "****"
        tail = plain[-4:] if len(plain) >= 4 else plain
        mask = f"****{tail}" if tail else "****"
        return True, mask

    async def get_tenant_policy(self, tenant_id: str) -> TenantFeePolicy | None:
        return await self.db.scalar(
            select(TenantFeePolicy).where(TenantFeePolicy.tenant_id == tenant_id)
        )

    async def get_effective_markup_percent(self, tenant_id: str) -> Decimal:
        platform_settings = await self.get_platform_settings()
        tenant_policy = await self.get_tenant_policy(tenant_id)
        if (
            tenant_policy is not None
            and tenant_policy.custom_markup_percent is not None
            and platform_settings.allow_tenant_markup_override
        ):
            return Decimal(tenant_policy.custom_markup_percent)
        return Decimal(platform_settings.default_markup_percent)

    async def get_effective_turnover_fee_percent(self, tenant_id: str) -> Decimal:
        return Decimal("0")

    async def get_provider_fee_percent(self) -> Decimal:
        return Decimal("1")

    async def get_exchange_rate_markup_percent(self) -> Decimal:
        try:
            return Decimal((await self.get_platform_settings()).exchange_rate_markup_percent)
        except SQLAlchemyError:
            await self.db.rollback()
            logger.exception(
                "Failed to load exchange_rate_markup_percent from platform settings; using 0 fallback."
            )
            return Decimal("0")

    async def get_manual_exchange_rates(self) -> dict[str, Decimal]:
        settings = await self.get_platform_settings()
        raw_value = settings.manual_exchange_rates_json or "{}"
        try:
            parsed = json.loads(raw_value)
        except (TypeError, ValueError):
            logger.exception("Failed to parse manual exchange rates JSON; using empty mapping.")
            return {}

        if not isinstance(parsed, dict):
            return {}

        normalized: dict[str, Decimal] = {}
        for key, value in parsed.items():
            symbol = str(key).strip().upper()
            if not symbol:
                continue
            try:
                rate = Decimal(str(value))
            except Exception:
                logger.warning("Skipping invalid manual exchange rate for %s: %r", symbol, value)
                continue
            if rate <= 0:
                logger.warning("Skipping non-positive manual exchange rate for %s: %s", symbol, rate)
                continue
            normalized[symbol] = rate
        return normalized

    async def get_cached_exchange_rates(self) -> dict[str, Decimal]:
        settings = await self.get_platform_settings()
        raw_value = settings.cached_exchange_rates_json or "{}"
        try:
            parsed = json.loads(raw_value)
        except (TypeError, ValueError):
            logger.exception("Failed to parse cached exchange rates JSON; using empty mapping.")
            return {}

        if not isinstance(parsed, dict):
            return {}

        normalized: dict[str, Decimal] = {}
        for key, value in parsed.items():
            symbol = str(key).strip().upper()
            if not symbol:
                continue
            try:
                rate = Decimal(str(value))
            except Exception:
                logger.warning("Skipping invalid cached exchange rate for %s: %r", symbol, value)
                continue
            if rate <= 0:
                logger.warning("Skipping non-positive cached exchange rate for %s: %s", symbol, rate)
                continue
            normalized[symbol] = rate
        return normalized

    async def update_cached_exchange_rates(self, rates: dict[str, Decimal]) -> PlatformSetting:
        normalized_rates = self._normalize_manual_exchange_rates(rates)
        settings = await self.get_platform_settings()
        settings.cached_exchange_rates_json = json.dumps(
            {key: str(value) for key, value in normalized_rates.items()},
            sort_keys=True,
        )
        settings.cached_exchange_rates_updated_at = datetime.now(timezone.utc)
        self.db.add(settings)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    async def update_platform_settings(
        self,
        *,
        default_markup_percent: Decimal,
        allow_tenant_markup_override: bool,
        payouts_enabled: bool,
        exchange_rate_markup_percent: Decimal = Decimal("0"),
        manual_exchange_rates: dict[str, Decimal] | None = None,
        seo_title: str | None = None,
        seo_description: str | None = None,
        seo_keywords: str | None = None,
        seo_favicon_url: str | None = None,
        seo_og_image_url: str | None = None,
        seo_robots: str = "index, follow",
        seo_canonical_url: str | None = None,
        # Устаревшие поля — игнорируются (комиссия провайдера 1%, минимум 0.55 USDT в коде).
        provider_fee_percent: Decimal | None = None,
        default_turnover_fee_percent: Decimal | None = None,
        allow_tenant_turnover_fee_override: bool | None = None,
        platform_markup_min_usdt: Decimal | None = None,
        platform_markup_min_band_usdt_low: Decimal | None = None,
        platform_markup_min_band_usdt_high: Decimal | None = None,
    ) -> PlatformSetting:
        self._validate_percent(default_markup_percent, "default_markup_percent")
        self._validate_rate_adjustment_percent(
            exchange_rate_markup_percent,
            "exchange_rate_markup_percent",
        )
        normalized_manual_exchange_rates = self._normalize_manual_exchange_rates(
            manual_exchange_rates or {}
        )

        settings = await self.get_platform_settings()
        settings.default_markup_percent = default_markup_percent
        settings.allow_tenant_markup_override = allow_tenant_markup_override
        settings.payouts_enabled = payouts_enabled
        settings.exchange_rate_markup_percent = exchange_rate_markup_percent
        settings.manual_exchange_rates_json = json.dumps(
            {key: str(value) for key, value in normalized_manual_exchange_rates.items()},
            sort_keys=True,
        )
        settings.seo_title = (seo_title or "").strip() or None
        settings.seo_description = (seo_description or "").strip() or None
        settings.seo_keywords = (seo_keywords or "").strip() or None
        settings.seo_favicon_url = (seo_favicon_url or "").strip() or None
        settings.seo_og_image_url = (seo_og_image_url or "").strip() or None
        settings.seo_robots = (seo_robots or "index, follow").strip() or "index, follow"
        settings.seo_canonical_url = (seo_canonical_url or "").strip() or None
        self.db.add(settings)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    async def get_or_create_tenant_policy(self, tenant_id: str) -> TenantFeePolicy:
        policy = await self.get_tenant_policy(tenant_id)
        if policy is None:
            policy = TenantFeePolicy(tenant_id=tenant_id)
            self.db.add(policy)
            await self.db.flush()
        return policy

    async def update_tenant_policy(
        self,
        tenant_id: str,
        *,
        custom_markup_percent: Decimal | None,
        custom_turnover_fee_percent: Decimal | None,
        payouts_enabled: bool,
        requires_manual_payout_review: bool,
    ) -> TenantFeePolicy:
        if custom_markup_percent is not None:
            self._validate_percent(custom_markup_percent, "custom_markup_percent")

        policy = await self.get_or_create_tenant_policy(tenant_id)
        policy.custom_markup_percent = custom_markup_percent
        policy.custom_turnover_fee_percent = None
        policy.payouts_enabled = payouts_enabled
        policy.requires_manual_payout_review = requires_manual_payout_review
        self.db.add(policy)
        await self.db.commit()
        await self.db.refresh(policy)
        return policy

    @staticmethod
    def _validate_non_negative(value: Decimal, field_name: str) -> None:
        if value < Decimal("0"):
            raise ValueError(f"{field_name} must be greater than or equal to 0.")

    @staticmethod
    def _validate_percent(value: Decimal, field_name: str) -> None:
        if value < Decimal("0") or value > Decimal("100"):
            raise ValueError(f"{field_name} must be between 0 and 100.")

    @staticmethod
    def _validate_rate_adjustment_percent(value: Decimal, field_name: str) -> None:
        if value <= Decimal("-100") or value > Decimal("100"):
            raise ValueError(f"{field_name} must be greater than -100 and less than or equal to 100.")

    @staticmethod
    def _normalize_manual_exchange_rates(
        rates: dict[str, Decimal | str | float | int],
    ) -> dict[str, Decimal]:
        normalized: dict[str, Decimal] = {}
        for raw_symbol, raw_rate in rates.items():
            symbol = str(raw_symbol).strip().upper()
            if not symbol:
                continue
            try:
                rate = Decimal(str(raw_rate))
            except Exception as exc:
                raise ValueError(f"manual_exchange_rates[{symbol}] must be a valid decimal.") from exc
            if rate <= Decimal("0"):
                raise ValueError(f"manual_exchange_rates[{symbol}] must be greater than 0.")
            normalized[symbol] = rate
        return normalized
