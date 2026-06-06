from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, Field, field_validator

ExchangeRatePriceField = Literal["last", "buy", "sell"]


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
    message_lines: str | None = None
    email_body: str | None = None
    telegram_body: str | None = None


class NotificationTemplateView(NotificationTemplateUpdate):
    title: str
    mode: str
    default_email_subject: str
    default_message_lines: str
    default_email_body: str
    default_telegram_body: str
    configured: bool = False


class NotificationTemplatePreviewRequest(BaseModel):
    code: str
    email_subject: str | None = None
    message_lines: str | None = None
    email_body: str | None = None
    telegram_body: str | None = None
    sample_context: dict[str, str] = Field(default_factory=dict)


class NotificationTemplatePreviewResponse(BaseModel):
    code: str
    title: str
    email_subject: str
    email_text: str
    email_html: str
    telegram_text: str
    variables: dict[str, str]


class NotificationTemplateTestRequest(NotificationTemplatePreviewRequest):
    test_recipient_email: str | None = Field(default=None, max_length=254)
    telegram_chat_id: str | None = Field(default=None, max_length=64)
    smtp_bz_api_key: str | None = None
    telegram_bot_token: str | None = None


class NotificationTemplateTestResponse(NotificationTemplatePreviewResponse):
    email_sent: bool = False
    telegram_sent: bool = False


class PlatformBillingSettingsResponse(BaseModel):
    provider_fee_percent: Decimal = Field(
        description="Комиссия провайдера (Crypto-Cash), % от gross.",
    )
    default_markup_percent: Decimal = Field(
        description="Наценка платформы, % от остатка после комиссии провайдера.",
    )
    default_turnover_fee_percent: Decimal = Field(
        default=Decimal("0"),
        description="Не используется; совместимость API.",
    )
    platform_markup_min_usdt: Decimal = Field(
        default=Decimal("0.55"),
        description="Минимум комиссии провайдера в USDT (если % от gross меньше).",
    )
    platform_fee_min_usdt: Decimal = Field(
        default=Decimal("0.2"),
        description="Фикс комиссии платформы в USDT, когда у провайдера сработал минимум.",
    )
    platform_markup_min_band_usdt_low: Decimal = Field(
        default=Decimal("0"),
        description="Не используется.",
    )
    platform_markup_min_band_usdt_high: Decimal = Field(
        default=Decimal("0"),
        description="Не используется.",
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
    exchange_rate_price_field: ExchangeRatePriceField = "last"
    manual_exchange_rates: dict[str, Decimal] = Field(default_factory=dict)
    current_exchange_rates: dict[str, Decimal] = Field(default_factory=dict)
    ops_telegram: "OpsTelegramSettingsView | None" = None


class OpsTelegramTopicUpdate(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    thread_id: int | None = None
    enabled: bool = True


class OpsTelegramEventToggle(BaseModel):
    code: str
    enabled: bool


class OpsTelegramTopicView(BaseModel):
    key: str
    title: str
    description: str
    thread_id: int | None = None
    enabled: bool = True
    event_codes: list[str] = Field(default_factory=list)
    events_enabled_count: int = 0


class OpsTelegramEventView(BaseModel):
    code: str
    topic_key: str
    topic_title: str
    enabled: bool


class OpsTelegramSettingsView(BaseModel):
    enabled: bool = False
    chat_id: str | None = None
    topics: list[OpsTelegramTopicView] = Field(default_factory=list)
    events: list[OpsTelegramEventView] = Field(default_factory=list)


class OpsTelegramSettingsUpdate(BaseModel):
    enabled: bool = False
    chat_id: str | None = None
    topics: list[OpsTelegramTopicUpdate] = Field(default_factory=list)
    events: list[OpsTelegramEventToggle] = Field(default_factory=list)


class OpsTelegramTopicTestRequest(BaseModel):
    topic_key: str = Field(min_length=1, max_length=64)
    chat_id: str | None = Field(default=None, max_length=64)
    thread_id: int | None = None


class OpsTelegramProvisionRequest(BaseModel):
    chat_id: str | None = Field(
        default=None,
        max_length=64,
        description="Chat ID из формы — сохраняется перед созданием топиков, если ещё не в БД.",
    )


class OpsTelegramTopicTestResponse(BaseModel):
    ok: bool
    topic_key: str
    chat_id: str | None = None
    thread_id: int | None = None
    telegram_message_id: int | None = None


class OpsTelegramProvisionResponse(BaseModel):
    ok: bool
    chat_id: str
    created_topics: dict[str, int] = Field(default_factory=dict)
    topics: dict[str, dict[str, int | bool | None]] = Field(default_factory=dict)


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
    platform_markup_min_usdt: Decimal = Field(
        default=Decimal("0.55"),
        description="Минимум комиссии провайдера в USDT (если % от gross меньше).",
    )
    platform_fee_min_usdt: Decimal = Field(
        default=Decimal("0.2"),
        description="Фикс комиссии платформы в USDT, когда у провайдера сработал минимум.",
    )
    allow_tenant_markup_override: bool
    payouts_enabled: bool
    default_turnover_fee_percent: Decimal | None = Field(default=None, description="Игнорируется.")
    platform_markup_min_band_usdt_low: Decimal | None = None
    platform_markup_min_band_usdt_high: Decimal | None = None
    allow_tenant_turnover_fee_override: bool | None = None
    email_notifications_enabled: bool = True
    telegram_notifications_enabled: bool = True
    smtp_bz_enabled: bool = False
    smtp_bz_api_base_url: str = "https://api.smtp.bz/v1"
    smtp_bz_sender_email: str = ""
    smtp_bz_sender_name: str = "NorenDigital"
    smtp_bz_reply_to: str | None = None
    smtp_bz_tag: str | None = None
    smtp_bz_api_key: str | None = None
    telegram_api_base_url: str = "https://api.telegram.org"
    telegram_bot_token: str | None = None
    notification_events: list[NotificationEventToggle] = Field(default_factory=list)
    notification_brand_name: str = "NorenDigital"
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
    exchange_rate_price_field: ExchangeRatePriceField = "last"
    manual_exchange_rates: dict[str, Decimal] = Field(default_factory=dict)
    ops_telegram: OpsTelegramSettingsUpdate | None = None


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
