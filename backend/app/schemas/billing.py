from decimal import Decimal

from pydantic import BaseModel, Field


class NotificationEventToggle(BaseModel):
    code: str
    email_enabled: bool
    telegram_enabled: bool


class NotificationEventView(NotificationEventToggle):
    title: str
    mode: str


class NotificationTemplateUpdate(BaseModel):
    code: str
    email_subject: str | None = None
    email_body: str | None = None
    telegram_body: str | None = None


class NotificationTemplateView(NotificationTemplateUpdate):
    title: str
    mode: str


class PlatformBillingSettingsResponse(BaseModel):
    provider_fee_percent: Decimal
    default_markup_percent: Decimal
    default_turnover_fee_percent: Decimal
    platform_markup_min_usdt: Decimal = Field(
        default=Decimal("0.5"),
        description="Минимальная наценка платформы в USDT при депозите в целевом диапазоне.",
    )
    platform_markup_min_band_usdt_low: Decimal = Field(
        default=Decimal("10"),
        description="Нижняя граница суммы инвойса (эквивалент USDT), включительно.",
    )
    platform_markup_min_band_usdt_high: Decimal = Field(
        default=Decimal("250"),
        description="Верхняя граница суммы инвойса (эквивалент USDT), включительно.",
    )
    allow_tenant_markup_override: bool
    allow_tenant_turnover_fee_override: bool
    payouts_enabled: bool
    email_notifications_enabled: bool
    telegram_notifications_enabled: bool
    smtp_bz_enabled: bool
    smtp_bz_api_base_url: str
    smtp_bz_sender_email: str
    smtp_bz_sender_name: str
    smtp_bz_reply_to: str | None = None
    smtp_bz_tag: str | None = None
    smtp_bz_api_key_configured: bool
    smtp_bz_api_key_masked: str | None = None
    telegram_api_base_url: str
    telegram_bot_token_configured: bool
    telegram_bot_token_masked: str | None = None
    notification_events: list[NotificationEventView]
    notification_brand_name: str
    notification_logo_url: str | None = None
    notification_primary_url: str | None = None
    notification_templates: list[NotificationTemplateView]
    notification_template_variables: list[str]
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: str | None = None
    seo_favicon_url: str | None = None
    seo_og_image_url: str | None = None
    seo_robots: str = "index, follow"
    seo_canonical_url: str | None = None
    exchange_rate_markup_percent: Decimal = Decimal("0")
    manual_exchange_rates: dict[str, Decimal] = Field(default_factory=dict)
    current_exchange_rates: dict[str, Decimal] = Field(default_factory=dict)


class ExchangeRateLookupResponse(BaseModel):
    currency: str
    quote_currency: str = "USD"
    rate: Decimal | None = None
    source: str = "api"


class ExchangeRateRefreshResponse(BaseModel):
    quote_currency: str = "USD"
    refreshed_symbols: int = 0
    cached_symbols: int = 0
    refreshed: bool = False


class PlatformBillingSettingsUpdateRequest(BaseModel):
    provider_fee_percent: Decimal
    default_markup_percent: Decimal
    default_turnover_fee_percent: Decimal
    platform_markup_min_usdt: Decimal = Decimal("0.5")
    platform_markup_min_band_usdt_low: Decimal = Decimal("10")
    platform_markup_min_band_usdt_high: Decimal = Decimal("250")
    allow_tenant_markup_override: bool
    allow_tenant_turnover_fee_override: bool
    payouts_enabled: bool
    email_notifications_enabled: bool = True
    telegram_notifications_enabled: bool = True
    smtp_bz_enabled: bool = False
    smtp_bz_api_base_url: str = "https://api.smtp.bz/v1"
    smtp_bz_sender_email: str = ""
    smtp_bz_sender_name: str = "NorenCash"
    smtp_bz_reply_to: str | None = None
    smtp_bz_tag: str | None = None
    smtp_bz_api_key: str | None = None
    telegram_api_base_url: str = "https://api.telegram.org"
    telegram_bot_token: str | None = None
    notification_events: list[NotificationEventToggle] = Field(default_factory=list)
    notification_brand_name: str = "NorenCash"
    notification_logo_url: str | None = None
    notification_primary_url: str | None = None
    notification_templates: list[NotificationTemplateUpdate] = Field(default_factory=list)
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: str | None = None
    seo_favicon_url: str | None = None
    seo_og_image_url: str | None = None
    seo_robots: str = "index, follow"
    seo_canonical_url: str | None = None
    exchange_rate_markup_percent: Decimal = Decimal("0")
    manual_exchange_rates: dict[str, Decimal] = Field(default_factory=dict)


class TelegramBotInspectRequest(BaseModel):
    telegram_api_base_url: str | None = None
    telegram_bot_token: str | None = None


class TelegramBotIdentityResponse(BaseModel):
    token_configured: bool
    token_masked: str | None = None
    api_base_url: str
    bot_id: int | None = None
    username: str | None = None
    first_name: str | None = None
    display_name: str | None = None
    checked_with_override: bool = False


class TelegramAdminTestRequest(BaseModel):
    admin_telegram_chat_id: str = Field(min_length=1, max_length=64)
    telegram_api_base_url: str | None = None
    telegram_bot_token: str | None = None


class TelegramAdminTestResponse(BaseModel):
    ok: bool
    chat_id: str
    api_base_url: str
    bot_username: str | None = None
    bot_display_name: str | None = None
    telegram_message_id: int | None = None


class TenantBillingPolicyResponse(BaseModel):
    tenant_id: str
    custom_markup_percent: Decimal | None
    custom_turnover_fee_percent: Decimal | None
    payouts_enabled: bool
    requires_manual_payout_review: bool


class TenantBillingPolicyUpdateRequest(BaseModel):
    custom_markup_percent: Decimal | None = None
    custom_turnover_fee_percent: Decimal | None = None
    payouts_enabled: bool = True
    requires_manual_payout_review: bool = True


class SmtpBzTestRequest(BaseModel):
    test_recipient_email: str = Field(min_length=5, max_length=254)
    smtp_bz_api_base_url: str | None = None
    smtp_bz_sender_email: str | None = None
    smtp_bz_sender_name: str | None = None
    smtp_bz_reply_to: str | None = None
    smtp_bz_tag: str | None = None
    smtp_bz_api_key: str | None = None


class SmtpBzTestResponse(BaseModel):
    ok: bool
    smtp_bz_api_base_url: str
    sender_email: str
    sender_name: str
    recipient_email: str
    tag: str | None = None
