from pydantic import BaseModel, Field


class MerchantNotificationSettingsResponse(BaseModel):
    email: str
    notify_email_enabled: bool
    notify_telegram_enabled: bool
    telegram_chat_id: str | None
    telegram_connected: bool


class MerchantNotificationSettingsUpdateRequest(BaseModel):
    notify_email_enabled: bool = True
    notify_telegram_enabled: bool = False
    telegram_chat_id: str | None = Field(default=None, max_length=64)
