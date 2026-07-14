from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field, fields
from decimal import Decimal, InvalidOperation
from typing import Any


DEFAULT_FREE_MAIL_DOMAINS = [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "mail.ru",
    "yandex.ru",
    "yandex.com",
    "proton.me",
    "protonmail.com",
]


@dataclass
class AffiliateProgramConfig:
    """All tunable affiliate knobs for superadmin."""

    # Program gates
    program_enabled: bool = True
    public_apply_enabled: bool = True
    auto_approve_partners: bool = False
    partner_cabinet_when_pending: bool = True

    # Economics
    commission_percent: Decimal = Decimal("25.0000")
    commission_override_allowed: bool = True
    commission_override_min_percent: Decimal = Decimal("0")
    commission_override_max_percent: Decimal = Decimal("100")

    # Attribution
    attribution_mode: str = "lifetime"  # lifetime | fixed_days
    attribution_days: int = 365
    cookie_days: int = 60
    click_mode: str = "last_click"  # last_click | first_click
    freeze_attribution_after_tenant_approve: bool = True
    track_clicks_from_pending_partners: bool = True
    require_approved_partner_for_attribution: bool = True

    # Accrual
    hold_days: int = 14
    accrue_only_approved_partners: bool = True
    accrue_only_approved_tenants: bool = True
    min_platform_fee_to_accrue_usdt: Decimal = Decimal("0")

    # Payouts
    payouts_enabled: bool = True
    min_payout_usdt: Decimal = Decimal("50")
    default_payout_network: str = "TRC20"
    allowed_payout_networks: list[str] = field(
        default_factory=lambda: ["TRC20", "ERC20", "BEP20"]
    )
    require_payout_address_on_apply: bool = False
    require_payout_address_before_request: bool = True

    # Anti-fraud
    block_self_referral_email: bool = True
    block_same_email_domain: bool = True
    self_referral_free_domains: list[str] = field(
        default_factory=lambda: list(DEFAULT_FREE_MAIL_DOMAINS)
    )

    # Partner UX / codes
    referral_code_length: int = 8
    show_merchant_names_to_partners: bool = True
    show_funnel_clicks_to_partners: bool = True

    # Optional CPA (disabled by default)
    cpa_enabled: bool = False
    cpa_amount_usdt: Decimal = Decimal("0")
    cpa_trigger: str = "first_volume"  # approved | first_volume

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "program_enabled": self.program_enabled,
            "public_apply_enabled": self.public_apply_enabled and self.program_enabled,
            "cookie_days": self.cookie_days,
            "click_mode": self.click_mode,
            "default_payout_network": self.default_payout_network,
            "allowed_payout_networks": list(self.allowed_payout_networks),
            "require_payout_address_on_apply": self.require_payout_address_on_apply,
            "commission_percent": str(self.commission_percent),
            "hold_days": self.hold_days,
            "min_payout_usdt": str(self.min_payout_usdt),
            "attribution_mode": self.attribution_mode,
            "attribution_days": self.attribution_days,
        }

    def to_storage_dict(self) -> dict[str, Any]:
        raw = asdict(self)
        for key, value in list(raw.items()):
            if isinstance(value, Decimal):
                raw[key] = str(value)
        return raw

    def to_admin_dict(self) -> dict[str, Any]:
        return self.to_storage_dict()


def default_affiliate_config() -> AffiliateProgramConfig:
    return AffiliateProgramConfig()


def _as_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _as_decimal(value: Any, default: Decimal) -> Decimal:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return default


def _as_int(value: Any, default: int, *, min_value: int | None = None, max_value: int | None = None) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    if min_value is not None:
        number = max(min_value, number)
    if max_value is not None:
        number = min(max_value, number)
    return number


def _as_str_list(value: Any, default: list[str]) -> list[str]:
    if value is None:
        return list(default)
    if isinstance(value, str):
        items = [part.strip() for part in value.replace(";", ",").split(",")]
        return [item for item in items if item]
    if isinstance(value, (list, tuple)):
        items = [str(item).strip() for item in value]
        return [item for item in items if item]
    return list(default)


def parse_affiliate_config(
    raw_json: str | None,
    *,
    legacy_commission_percent: Decimal | None = None,
    legacy_hold_days: int | None = None,
    legacy_min_payout_usdt: Decimal | None = None,
    legacy_cookie_days: int | None = None,
) -> AffiliateProgramConfig:
    cfg = default_affiliate_config()
    if legacy_commission_percent is not None:
        cfg.commission_percent = Decimal(legacy_commission_percent)
    if legacy_hold_days is not None:
        cfg.hold_days = int(legacy_hold_days)
    if legacy_min_payout_usdt is not None:
        cfg.min_payout_usdt = Decimal(legacy_min_payout_usdt)
    if legacy_cookie_days is not None:
        cfg.cookie_days = int(legacy_cookie_days)

    if not raw_json:
        return cfg
    try:
        parsed = json.loads(raw_json)
    except (TypeError, ValueError):
        return cfg
    if not isinstance(parsed, dict):
        return cfg

    cfg.program_enabled = _as_bool(parsed.get("program_enabled"), cfg.program_enabled)
    cfg.public_apply_enabled = _as_bool(
        parsed.get("public_apply_enabled"), cfg.public_apply_enabled
    )
    cfg.auto_approve_partners = _as_bool(
        parsed.get("auto_approve_partners"), cfg.auto_approve_partners
    )
    cfg.partner_cabinet_when_pending = _as_bool(
        parsed.get("partner_cabinet_when_pending"), cfg.partner_cabinet_when_pending
    )

    cfg.commission_percent = _as_decimal(
        parsed.get("commission_percent"), cfg.commission_percent
    )
    cfg.commission_override_allowed = _as_bool(
        parsed.get("commission_override_allowed"), cfg.commission_override_allowed
    )
    cfg.commission_override_min_percent = _as_decimal(
        parsed.get("commission_override_min_percent"), cfg.commission_override_min_percent
    )
    cfg.commission_override_max_percent = _as_decimal(
        parsed.get("commission_override_max_percent"), cfg.commission_override_max_percent
    )

    attribution_mode = str(parsed.get("attribution_mode") or cfg.attribution_mode).lower()
    cfg.attribution_mode = (
        attribution_mode if attribution_mode in {"lifetime", "fixed_days"} else "lifetime"
    )
    cfg.attribution_days = _as_int(
        parsed.get("attribution_days"), cfg.attribution_days, min_value=1, max_value=3650
    )
    cfg.cookie_days = _as_int(
        parsed.get("cookie_days"), cfg.cookie_days, min_value=1, max_value=730
    )
    click_mode = str(parsed.get("click_mode") or cfg.click_mode).lower()
    cfg.click_mode = click_mode if click_mode in {"last_click", "first_click"} else "last_click"
    cfg.freeze_attribution_after_tenant_approve = _as_bool(
        parsed.get("freeze_attribution_after_tenant_approve"),
        cfg.freeze_attribution_after_tenant_approve,
    )
    cfg.track_clicks_from_pending_partners = _as_bool(
        parsed.get("track_clicks_from_pending_partners"),
        cfg.track_clicks_from_pending_partners,
    )
    cfg.require_approved_partner_for_attribution = _as_bool(
        parsed.get("require_approved_partner_for_attribution"),
        cfg.require_approved_partner_for_attribution,
    )

    cfg.hold_days = _as_int(parsed.get("hold_days"), cfg.hold_days, min_value=0, max_value=365)
    cfg.accrue_only_approved_partners = _as_bool(
        parsed.get("accrue_only_approved_partners"), cfg.accrue_only_approved_partners
    )
    cfg.accrue_only_approved_tenants = _as_bool(
        parsed.get("accrue_only_approved_tenants"), cfg.accrue_only_approved_tenants
    )
    cfg.min_platform_fee_to_accrue_usdt = _as_decimal(
        parsed.get("min_platform_fee_to_accrue_usdt"), cfg.min_platform_fee_to_accrue_usdt
    )

    cfg.payouts_enabled = _as_bool(parsed.get("payouts_enabled"), cfg.payouts_enabled)
    cfg.min_payout_usdt = _as_decimal(parsed.get("min_payout_usdt"), cfg.min_payout_usdt)
    cfg.default_payout_network = (
        str(parsed.get("default_payout_network") or cfg.default_payout_network)
        .strip()
        .upper()
        or "TRC20"
    )
    cfg.allowed_payout_networks = [
        item.upper()
        for item in _as_str_list(parsed.get("allowed_payout_networks"), cfg.allowed_payout_networks)
    ]
    if not cfg.allowed_payout_networks:
        cfg.allowed_payout_networks = ["TRC20"]
    cfg.require_payout_address_on_apply = _as_bool(
        parsed.get("require_payout_address_on_apply"), cfg.require_payout_address_on_apply
    )
    cfg.require_payout_address_before_request = _as_bool(
        parsed.get("require_payout_address_before_request"),
        cfg.require_payout_address_before_request,
    )

    cfg.block_self_referral_email = _as_bool(
        parsed.get("block_self_referral_email"), cfg.block_self_referral_email
    )
    cfg.block_same_email_domain = _as_bool(
        parsed.get("block_same_email_domain"), cfg.block_same_email_domain
    )
    cfg.self_referral_free_domains = [
        item.lower()
        for item in _as_str_list(
            parsed.get("self_referral_free_domains"), cfg.self_referral_free_domains
        )
    ]

    cfg.referral_code_length = _as_int(
        parsed.get("referral_code_length"), cfg.referral_code_length, min_value=4, max_value=16
    )
    cfg.show_merchant_names_to_partners = _as_bool(
        parsed.get("show_merchant_names_to_partners"), cfg.show_merchant_names_to_partners
    )
    cfg.show_funnel_clicks_to_partners = _as_bool(
        parsed.get("show_funnel_clicks_to_partners"), cfg.show_funnel_clicks_to_partners
    )

    cfg.cpa_enabled = _as_bool(parsed.get("cpa_enabled"), cfg.cpa_enabled)
    cfg.cpa_amount_usdt = _as_decimal(parsed.get("cpa_amount_usdt"), cfg.cpa_amount_usdt)
    cpa_trigger = str(parsed.get("cpa_trigger") or cfg.cpa_trigger).lower()
    cfg.cpa_trigger = cpa_trigger if cpa_trigger in {"approved", "first_volume"} else "first_volume"

    # Clamp commission bounds.
    if cfg.commission_override_min_percent < 0:
        cfg.commission_override_min_percent = Decimal("0")
    if cfg.commission_override_max_percent > 100:
        cfg.commission_override_max_percent = Decimal("100")
    if cfg.commission_override_min_percent > cfg.commission_override_max_percent:
        cfg.commission_override_min_percent, cfg.commission_override_max_percent = (
            cfg.commission_override_max_percent,
            cfg.commission_override_min_percent,
        )
    if cfg.commission_percent < 0:
        cfg.commission_percent = Decimal("0")
    if cfg.commission_percent > 100:
        cfg.commission_percent = Decimal("100")
    return cfg


def config_from_payload(payload: dict[str, Any]) -> AffiliateProgramConfig:
    # Reuse parser by dumping known fields; ignores unknown keys softly.
    allowed = {item.name for item in fields(AffiliateProgramConfig)}
    filtered = {key: value for key, value in payload.items() if key in allowed}
    return parse_affiliate_config(json.dumps(filtered))
