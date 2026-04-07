from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform_setting import PlatformSetting
from app.models.tenant_fee_policy import TenantFeePolicy


class BillingPolicyService:
    DEFAULT_CODE = "default"

    def __init__(self, db: Session):
        self.db = db

    def get_platform_settings(self) -> PlatformSetting:
        settings = self.db.scalar(
            select(PlatformSetting).where(PlatformSetting.code == self.DEFAULT_CODE)
        )
        if settings is None:
            settings = PlatformSetting(code=self.DEFAULT_CODE)
            self.db.add(settings)
            self.db.flush()
        return settings

    def get_tenant_policy(self, tenant_id: str) -> TenantFeePolicy | None:
        return self.db.scalar(
            select(TenantFeePolicy).where(TenantFeePolicy.tenant_id == tenant_id)
        )

    def get_effective_markup_percent(self, tenant_id: str) -> Decimal:
        platform_settings = self.get_platform_settings()
        tenant_policy = self.get_tenant_policy(tenant_id)
        if (
            tenant_policy is not None
            and tenant_policy.custom_markup_percent is not None
            and platform_settings.allow_tenant_markup_override
        ):
            return Decimal(tenant_policy.custom_markup_percent)
        return Decimal(platform_settings.default_markup_percent)

    def get_effective_turnover_fee_percent(self, tenant_id: str) -> Decimal:
        platform_settings = self.get_platform_settings()
        tenant_policy = self.get_tenant_policy(tenant_id)
        if (
            tenant_policy is not None
            and tenant_policy.custom_turnover_fee_percent is not None
            and platform_settings.allow_tenant_turnover_fee_override
        ):
            return Decimal(tenant_policy.custom_turnover_fee_percent)
        return Decimal(platform_settings.default_turnover_fee_percent)

    def get_provider_fee_percent(self) -> Decimal:
        return Decimal(self.get_platform_settings().provider_fee_percent)

    def update_platform_settings(
        self,
        *,
        provider_fee_percent: Decimal,
        default_markup_percent: Decimal,
        default_turnover_fee_percent: Decimal,
        allow_tenant_markup_override: bool,
        allow_tenant_turnover_fee_override: bool,
        payouts_enabled: bool,
        seo_title: str | None = None,
        seo_description: str | None = None,
        seo_keywords: str | None = None,
        seo_favicon_url: str | None = None,
        seo_og_image_url: str | None = None,
        seo_robots: str = "index, follow",
        seo_canonical_url: str | None = None,
    ) -> PlatformSetting:
        self._validate_percent(provider_fee_percent, "provider_fee_percent")
        self._validate_percent(default_markup_percent, "default_markup_percent")
        self._validate_percent(default_turnover_fee_percent, "default_turnover_fee_percent")

        settings = self.get_platform_settings()
        settings.provider_fee_percent = provider_fee_percent
        settings.default_markup_percent = default_markup_percent
        settings.default_turnover_fee_percent = default_turnover_fee_percent
        settings.allow_tenant_markup_override = allow_tenant_markup_override
        settings.allow_tenant_turnover_fee_override = allow_tenant_turnover_fee_override
        settings.payouts_enabled = payouts_enabled
        settings.seo_title = (seo_title or "").strip() or None
        settings.seo_description = (seo_description or "").strip() or None
        settings.seo_keywords = (seo_keywords or "").strip() or None
        settings.seo_favicon_url = (seo_favicon_url or "").strip() or None
        settings.seo_og_image_url = (seo_og_image_url or "").strip() or None
        settings.seo_robots = (seo_robots or "index, follow").strip() or "index, follow"
        settings.seo_canonical_url = (seo_canonical_url or "").strip() or None
        self.db.add(settings)
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def get_or_create_tenant_policy(self, tenant_id: str) -> TenantFeePolicy:
        policy = self.get_tenant_policy(tenant_id)
        if policy is None:
            policy = TenantFeePolicy(tenant_id=tenant_id)
            self.db.add(policy)
            self.db.flush()
        return policy

    def update_tenant_policy(
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
        if custom_turnover_fee_percent is not None:
            self._validate_percent(custom_turnover_fee_percent, "custom_turnover_fee_percent")

        policy = self.get_or_create_tenant_policy(tenant_id)
        policy.custom_markup_percent = custom_markup_percent
        policy.custom_turnover_fee_percent = custom_turnover_fee_percent
        policy.payouts_enabled = payouts_enabled
        policy.requires_manual_payout_review = requires_manual_payout_review
        self.db.add(policy)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    @staticmethod
    def _validate_percent(value: Decimal, field_name: str) -> None:
        if value < Decimal("0") or value > Decimal("100"):
            raise ValueError(f"{field_name} должен быть в диапазоне от 0 до 100.")
