from __future__ import annotations

from datetime import datetime, timezone
from dataclasses import dataclass
from html import escape
import json
import logging
import re
from typing import Any, Iterable
from urllib.parse import urlparse

import requests
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_value, encrypt_value
from app.models.platform_setting import PlatformSetting
from app.models.user import User
from app.services.billing_policy_service import BillingPolicyService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NotificationEventDefinition:
    code: str
    title: str
    mode: str


@dataclass(frozen=True)
class NotificationTemplatePayload:
    email_subject: str | None
    email_body: str | None
    telegram_body: str | None


@dataclass(frozen=True)
class RenderedNotificationPayload:
    email_subject: str
    email_text: str
    email_html: str
    telegram_text: str


class NotificationService:
    EVENT_APPLICATION_SUBMITTED = "application_submitted"
    EVENT_APPLICATION_APPROVED = "application_approved"
    EVENT_APPLICATION_REJECTED = "application_rejected"
    EVENT_PASSWORD_GENERATED = "password_generated"
    EVENT_PASSWORD_CHANGED = "password_changed"
    EVENT_API_KEY_GENERATED = "api_key_generated"
    EVENT_API_KEY_REGENERATED = "api_key_regenerated"
    EVENT_API_KEY_REVOKED = "api_key_revoked"
    EVENT_TWO_FACTOR_ENABLED = "two_factor_enabled"
    EVENT_TWO_FACTOR_DISABLED = "two_factor_disabled"
    EVENT_PAYOUT_REQUESTED = "payout_requested"
    EVENT_PAYOUT_APPROVED = "payout_approved"
    EVENT_PAYOUT_REJECTED = "payout_rejected"

    EVENT_DEFINITIONS: tuple[NotificationEventDefinition, ...] = (
        NotificationEventDefinition(
            code=EVENT_APPLICATION_SUBMITTED,
            title="Заявка на подключение проекта",
            mode="notify",
        ),
        NotificationEventDefinition(
            code=EVENT_APPLICATION_APPROVED,
            title="Заявка одобрена",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_APPLICATION_REJECTED,
            title="Заявка отклонена",
            mode="notify",
        ),
        NotificationEventDefinition(
            code=EVENT_PASSWORD_GENERATED,
            title="Сгенерирован пароль для входа",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_PASSWORD_CHANGED,
            title="Пароль изменен",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_API_KEY_GENERATED,
            title="Сгенерирован API-ключ",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_API_KEY_REGENERATED,
            title="API-ключ перевыпущен",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_API_KEY_REVOKED,
            title="API-ключ отозван",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_TWO_FACTOR_ENABLED,
            title="2FA включена",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_TWO_FACTOR_DISABLED,
            title="2FA отключена",
            mode="confirm",
        ),
        NotificationEventDefinition(
            code=EVENT_PAYOUT_REQUESTED,
            title="Запрос на выплату создан",
            mode="notify",
        ),
        NotificationEventDefinition(
            code=EVENT_PAYOUT_APPROVED,
            title="Запрос на выплату одобрен",
            mode="notify",
        ),
        NotificationEventDefinition(
            code=EVENT_PAYOUT_REJECTED,
            title="Запрос на выплату отклонен",
            mode="notify",
        ),
    )
    EVENT_DEFINITION_BY_CODE = {item.code: item for item in EVENT_DEFINITIONS}
    DEFAULT_EMAIL_EVENTS = {item.code for item in EVENT_DEFINITIONS}
    DEFAULT_TELEGRAM_EVENTS = {item.code for item in EVENT_DEFINITIONS}
    DEFAULT_SMTP_BZ_API_BASE_URL = "https://api.smtp.bz/v1"
    DEFAULT_TELEGRAM_API_BASE_URL = "https://api.telegram.org"
    TEMPLATE_VARIABLES: tuple[str, ...] = (
        "event_code",
        "event_title",
        "event_subject",
        "message_lines",
        "message_lines_html",
        "user_email",
        "user_full_name",
        "brand_name",
        "brand_url",
        "utc_now",
    )

    def __init__(self, db: AsyncSession):
        self.db = db

    def get_platform_event_views(self, platform_settings: PlatformSetting) -> list[dict[str, Any]]:
        email_events = self._parse_event_codes(
            platform_settings.email_notification_events_json,
            fallback=self.DEFAULT_EMAIL_EVENTS,
        )
        telegram_events = self._parse_event_codes(
            platform_settings.telegram_notification_events_json,
            fallback=self.DEFAULT_TELEGRAM_EVENTS,
        )
        return [
            {
                "code": item.code,
                "title": item.title,
                "mode": item.mode,
                "email_enabled": item.code in email_events,
                "telegram_enabled": item.code in telegram_events,
            }
            for item in self.EVENT_DEFINITIONS
        ]

    def get_platform_template_views(self, platform_settings: PlatformSetting) -> list[dict[str, Any]]:
        template_map = self._parse_template_map(
            platform_settings.notification_templates_json
        )
        return [
            {
                "code": definition.code,
                "title": definition.title,
                "mode": definition.mode,
                "email_subject": template_map.get(definition.code, {}).get("email_subject"),
                "email_body": template_map.get(definition.code, {}).get("email_body"),
                "telegram_body": template_map.get(definition.code, {}).get("telegram_body"),
            }
            for definition in self.EVENT_DEFINITIONS
        ]

    def get_template_variables(self) -> list[str]:
        return list(self.TEMPLATE_VARIABLES)

    async def update_platform_notification_settings(
        self,
        platform_settings: PlatformSetting,
        *,
        email_notifications_enabled: bool,
        telegram_notifications_enabled: bool,
        event_toggles: Iterable[Any],
        smtp_bz_enabled: bool,
        smtp_bz_api_base_url: str,
        smtp_bz_sender_email: str,
        smtp_bz_sender_name: str,
        smtp_bz_reply_to: str | None,
        smtp_bz_tag: str | None,
        smtp_bz_api_key: str | None,
        telegram_api_base_url: str,
        telegram_bot_token: str | None = None,
        notification_brand_name: str = "NorenCash",
        notification_logo_url: str | None = None,
        notification_primary_url: str | None = None,
        notification_templates: Iterable[Any] = (),
    ) -> PlatformSetting:
        current_email_events = self._parse_event_codes(
            platform_settings.email_notification_events_json,
            fallback=self.DEFAULT_EMAIL_EVENTS,
        )
        current_telegram_events = self._parse_event_codes(
            platform_settings.telegram_notification_events_json,
            fallback=self.DEFAULT_TELEGRAM_EVENTS,
        )

        toggle_by_code: dict[str, tuple[bool, bool]] = {}
        for item in event_toggles:
            code_raw = getattr(item, "code", None)
            code = str(code_raw or "").strip()
            if code not in self.EVENT_DEFINITION_BY_CODE:
                continue
            email_enabled = bool(getattr(item, "email_enabled", False))
            telegram_enabled = bool(getattr(item, "telegram_enabled", False))
            toggle_by_code[code] = (email_enabled, telegram_enabled)

        final_email_events: set[str] = set()
        final_telegram_events: set[str] = set()
        for definition in self.EVENT_DEFINITIONS:
            current_email_enabled = definition.code in current_email_events
            current_telegram_enabled = definition.code in current_telegram_events
            next_email_enabled, next_telegram_enabled = toggle_by_code.get(
                definition.code,
                (current_email_enabled, current_telegram_enabled),
            )
            if next_email_enabled:
                final_email_events.add(definition.code)
            if next_telegram_enabled:
                final_telegram_events.add(definition.code)

        platform_settings.email_notifications_enabled = email_notifications_enabled
        platform_settings.telegram_notifications_enabled = telegram_notifications_enabled
        platform_settings.email_notification_events_json = json.dumps(
            sorted(final_email_events),
            ensure_ascii=False,
        )
        platform_settings.telegram_notification_events_json = json.dumps(
            sorted(final_telegram_events),
            ensure_ascii=False,
        )
        platform_settings.smtp_bz_enabled = bool(smtp_bz_enabled)
        platform_settings.smtp_bz_api_base_url = self._normalize_smtp_bz_api_base_url(
            smtp_bz_api_base_url
        )
        platform_settings.smtp_bz_sender_email = (smtp_bz_sender_email or "").strip()
        platform_settings.smtp_bz_sender_name = (smtp_bz_sender_name or "").strip() or "NorenCash"
        normalized_reply_to = (smtp_bz_reply_to or "").strip()
        platform_settings.smtp_bz_reply_to = normalized_reply_to or None
        normalized_tag = (smtp_bz_tag or "").strip()
        platform_settings.smtp_bz_tag = normalized_tag or None
        if smtp_bz_api_key is not None:
            normalized_key = smtp_bz_api_key.strip()
            platform_settings.smtp_bz_api_key_encrypted = (
                encrypt_value(normalized_key) if normalized_key else None
            )
        platform_settings.telegram_api_base_url = self._normalize_telegram_api_base_url(
            telegram_api_base_url
        )
        if telegram_bot_token is not None:
            normalized_telegram_bot_token = telegram_bot_token.strip()
            platform_settings.telegram_bot_token_encrypted = (
                encrypt_value(normalized_telegram_bot_token)
                if normalized_telegram_bot_token
                else None
            )
        platform_settings.notification_brand_name = (
            (notification_brand_name or "").strip() or "NorenCash"
        )
        normalized_logo_url = (notification_logo_url or "").strip()
        platform_settings.notification_logo_url = normalized_logo_url or None
        normalized_primary_url = (notification_primary_url or "").strip()
        platform_settings.notification_primary_url = normalized_primary_url or None
        platform_settings.notification_templates_json = json.dumps(
            self._normalize_templates(notification_templates),
            ensure_ascii=False,
        )

        if platform_settings.smtp_bz_reply_to and "@" not in platform_settings.smtp_bz_reply_to:
            raise ValueError("SMTP.bz reply-to email указан некорректно.")
        if platform_settings.notification_logo_url:
            self._validate_public_url(
                platform_settings.notification_logo_url,
                "Notification logo URL is invalid.",
            )
        if platform_settings.notification_primary_url:
            self._validate_public_url(
                platform_settings.notification_primary_url,
                "Notification primary URL is invalid.",
            )
        if platform_settings.smtp_bz_enabled:
            if not platform_settings.smtp_bz_sender_email:
                raise ValueError("Укажите email отправителя SMTP.bz.")
            if "@" not in platform_settings.smtp_bz_sender_email:
                raise ValueError("Email отправителя SMTP.bz указан некорректно.")
            if not (
                (platform_settings.smtp_bz_api_key_encrypted or "").strip()
                or (smtp_bz_api_key or "").strip()
            ):
                raise ValueError("Укажите API-ключ SMTP.bz для включенной email-отправки.")

        if (
            platform_settings.telegram_notifications_enabled
            and not (
                (platform_settings.telegram_bot_token_encrypted or "").strip()
                or (telegram_bot_token or "").strip()
            )
        ):
            raise ValueError(
                "Укажите Telegram Bot Token для включенных Telegram-уведомлений."
            )

        self.db.add(platform_settings)
        await self.db.commit()
        await self.db.refresh(platform_settings)
        return platform_settings

    def get_user_notification_settings(self, user: User) -> dict[str, Any]:
        return {
            "email": user.email,
            "notify_email_enabled": bool(user.notify_email_enabled),
            "notify_telegram_enabled": bool(user.notify_telegram_enabled),
            "telegram_chat_id": user.telegram_chat_id,
            "telegram_connected": bool((user.telegram_chat_id or "").strip()),
        }

    async def update_user_notification_settings(
        self,
        user: User,
        *,
        notify_email_enabled: bool,
        notify_telegram_enabled: bool,
        telegram_chat_id: str | None,
    ) -> User:
        user.notify_email_enabled = notify_email_enabled
        user.notify_telegram_enabled = notify_telegram_enabled
        normalized_chat_id = (telegram_chat_id or "").strip()
        user.telegram_chat_id = normalized_chat_id or None
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def notify_user(
        self,
        user: User,
        *,
        event_code: str,
        subject: str,
        lines: Iterable[str],
        force_email: bool = False,
        force_telegram: bool = False,
    ) -> None:
        if event_code not in self.EVENT_DEFINITION_BY_CODE:
            return

        platform_settings = await BillingPolicyService(self.db).get_platform_settings()
        email_events = self._parse_event_codes(
            platform_settings.email_notification_events_json,
            fallback=self.DEFAULT_EMAIL_EVENTS,
        )
        telegram_events = self._parse_event_codes(
            platform_settings.telegram_notification_events_json,
            fallback=self.DEFAULT_TELEGRAM_EVENTS,
        )
        normalized_lines = [line.strip() for line in lines if line and line.strip()]
        if not normalized_lines:
            normalized_lines = [subject]
        rendered_payload = self._render_notification_payload(
            platform_settings=platform_settings,
            user=user,
            event_code=event_code,
            fallback_subject=subject,
            fallback_lines=normalized_lines,
        )

        if (
            platform_settings.email_notifications_enabled
            and event_code in email_events
            and (force_email or user.notify_email_enabled)
            and bool((user.email or "").strip())
        ):
            self._send_email(
                platform_settings=platform_settings,
                to_email=user.email,
                subject=rendered_payload.email_subject,
                lines=[line for line in rendered_payload.email_text.split("\n") if line.strip()],
                html_body=rendered_payload.email_html,
            )

        if (
            platform_settings.telegram_notifications_enabled
            and event_code in telegram_events
            and (force_telegram or user.notify_telegram_enabled)
            and bool((user.telegram_chat_id or "").strip())
        ):
            self._send_telegram(
                platform_settings=platform_settings,
                chat_id=user.telegram_chat_id or "",
                message_text=rendered_payload.telegram_text,
            )

    async def notify_tenant_users(
        self,
        tenant_id: str,
        *,
        event_code: str,
        subject: str,
        lines: Iterable[str],
        owner_only: bool = False,
        exclude_user_id: str | None = None,
        force_email: bool = False,
        force_telegram: bool = False,
    ) -> None:
        recipients = await self._list_tenant_recipients(tenant_id=tenant_id, owner_only=owner_only)
        for recipient in recipients:
            if exclude_user_id and recipient.id == exclude_user_id:
                continue
            await self.notify_user(
                recipient,
                event_code=event_code,
                subject=subject,
                lines=lines,
                force_email=force_email,
                force_telegram=force_telegram,
            )

    async def _list_tenant_recipients(self, *, tenant_id: str, owner_only: bool) -> list[User]:
        stmt = select(User).where(
            User.tenant_id == tenant_id,
            User.status.in_(["active", "invited"]),
        )
        if owner_only:
            stmt = stmt.where(User.role == "tenant_owner")
        stmt = stmt.order_by(User.created_at.asc())
        return list((await self.db.scalars(stmt)).all())

    @classmethod
    def _parse_event_codes(cls, raw_value: str | None, *, fallback: set[str]) -> set[str]:
        if not raw_value:
            return set(fallback)
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            return set(fallback)
        if not isinstance(parsed, list):
            return set(fallback)
        valid_codes = {
            str(item).strip()
            for item in parsed
            if str(item).strip() in cls.EVENT_DEFINITION_BY_CODE
        }
        return valid_codes or set(fallback)

    @classmethod
    def _parse_template_map(cls, raw_value: str | None) -> dict[str, dict[str, str]]:
        if not raw_value:
            return {}
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            return {}
        if not isinstance(parsed, dict):
            return {}

        normalized: dict[str, dict[str, str]] = {}
        for raw_code, raw_template in parsed.items():
            code = str(raw_code or "").strip()
            if code not in cls.EVENT_DEFINITION_BY_CODE or not isinstance(raw_template, dict):
                continue
            email_subject = str(raw_template.get("email_subject") or "").strip()
            email_body = str(raw_template.get("email_body") or "").strip()
            telegram_body = str(raw_template.get("telegram_body") or "").strip()
            if not any([email_subject, email_body, telegram_body]):
                continue
            normalized[code] = {
                "email_subject": email_subject,
                "email_body": email_body,
                "telegram_body": telegram_body,
            }
        return normalized

    @classmethod
    def _normalize_templates(cls, templates: Iterable[Any]) -> dict[str, dict[str, str]]:
        normalized: dict[str, dict[str, str]] = {}
        for item in templates:
            code_raw = getattr(item, "code", None)
            code = str(code_raw or "").strip()
            if code not in cls.EVENT_DEFINITION_BY_CODE:
                continue
            email_subject = str(getattr(item, "email_subject", "") or "").strip()
            email_body = str(getattr(item, "email_body", "") or "").strip()
            telegram_body = str(getattr(item, "telegram_body", "") or "").strip()
            if not any([email_subject, email_body, telegram_body]):
                continue
            normalized[code] = {
                "email_subject": email_subject,
                "email_body": email_body,
                "telegram_body": telegram_body,
            }
        return normalized

    def _render_notification_payload(
        self,
        *,
        platform_settings: PlatformSetting,
        user: User,
        event_code: str,
        fallback_subject: str,
        fallback_lines: list[str],
    ) -> RenderedNotificationPayload:
        definition = self.EVENT_DEFINITION_BY_CODE[event_code]
        template_map = self._parse_template_map(platform_settings.notification_templates_json)
        template = template_map.get(event_code, {})
        normalized_subject = fallback_subject.strip() or definition.title
        message_lines = [line.strip() for line in fallback_lines if line.strip()]
        if not message_lines:
            message_lines = [normalized_subject]
        message_lines_text = "\n".join(message_lines)
        message_lines_html = "".join(f"<p>{escape(line)}</p>" for line in message_lines)

        context = {
            "event_code": event_code,
            "event_title": definition.title,
            "event_subject": normalized_subject,
            "message_lines": message_lines_text,
            "message_lines_html": message_lines_html,
            "user_email": (user.email or "").strip(),
            "user_full_name": (user.full_name or "").strip(),
            "brand_name": (platform_settings.notification_brand_name or "").strip() or "NorenCash",
            "brand_url": (platform_settings.notification_primary_url or "").strip(),
            "utc_now": datetime.now(timezone.utc).isoformat(),
        }

        rendered_subject = self._render_template(
            str(template.get("email_subject") or "").strip() or normalized_subject,
            context,
        )
        rendered_email_body = self._render_template(
            str(template.get("email_body") or "").strip(),
            context,
        )
        rendered_telegram_body = self._render_template(
            str(template.get("telegram_body") or "").strip(),
            context,
        )

        if rendered_email_body:
            safe_email_html = rendered_email_body
            safe_email_text = self._strip_html(rendered_email_body)
        else:
            safe_email_html = message_lines_html
            safe_email_text = message_lines_text

        branded_email_html = self._wrap_email_html(
            body_html=safe_email_html,
            brand_name=context["brand_name"],
            logo_url=(platform_settings.notification_logo_url or "").strip() or None,
            brand_url=context["brand_url"] or None,
        )

        telegram_text = rendered_telegram_body or f"{rendered_subject}\n\n{message_lines_text}"

        return RenderedNotificationPayload(
            email_subject=rendered_subject,
            email_text=safe_email_text,
            email_html=branded_email_html,
            telegram_text=telegram_text,
        )

    def is_smtp_bz_api_key_configured(self, platform_settings: PlatformSetting) -> bool:
        return bool((platform_settings.smtp_bz_api_key_encrypted or "").strip())

    def get_masked_smtp_bz_api_key(self, platform_settings: PlatformSetting) -> str | None:
        encrypted = (platform_settings.smtp_bz_api_key_encrypted or "").strip()
        if not encrypted:
            return None
        api_key = self._get_smtp_bz_api_key(platform_settings)
        return self._mask_secret(api_key) if api_key else "Stored"

    def is_telegram_bot_token_configured(self, platform_settings: PlatformSetting) -> bool:
        return bool((platform_settings.telegram_bot_token_encrypted or "").strip())

    def get_masked_telegram_bot_token(self, platform_settings: PlatformSetting) -> str | None:
        encrypted = (platform_settings.telegram_bot_token_encrypted or "").strip()
        if not encrypted:
            return None
        token = self._get_telegram_bot_token(platform_settings)
        return self._mask_token(token) if token else "Stored"

    def inspect_telegram_bot(
        self,
        *,
        platform_settings: PlatformSetting,
        telegram_api_base_url: str | None = None,
        telegram_bot_token: str | None = None,
    ) -> dict[str, Any]:
        bot_token, api_base_url, checked_with_override = self._resolve_telegram_transport(
            platform_settings=platform_settings,
            telegram_api_base_url=telegram_api_base_url,
            telegram_bot_token=telegram_bot_token,
        )
        if not bot_token:
            raise ValueError("Telegram Bot Token не настроен.")

        try:
            response = requests.get(
                f"{api_base_url}/bot{bot_token}/getMe",
                timeout=8,
            )
        except Exception as exc:
            raise ValueError(f"Не удалось выполнить getMe: {exc}") from exc

        if response.status_code >= 400:
            raise ValueError(f"Telegram API вернул HTTP {response.status_code}: {response.text[:240]}")

        try:
            payload = response.json()
        except ValueError as exc:
            raise ValueError("Telegram API вернул невалидный JSON в getMe.") from exc

        if not isinstance(payload, dict) or payload.get("ok") is not True:
            description = ""
            if isinstance(payload, dict):
                description = str(payload.get("description") or "").strip()
            raise ValueError(description or "Telegram API отклонил запрос getMe.")

        result = payload.get("result")
        if not isinstance(result, dict):
            raise ValueError("Telegram API вернул пустой ответ getMe.")

        username_raw = str(result.get("username") or "").strip()
        first_name_raw = str(result.get("first_name") or "").strip()
        last_name_raw = str(result.get("last_name") or "").strip()
        display_name = " ".join(part for part in [first_name_raw, last_name_raw] if part).strip()
        if not display_name and username_raw:
            display_name = f"@{username_raw}"

        bot_id_value = result.get("id")
        bot_id = int(bot_id_value) if isinstance(bot_id_value, int) else None

        return {
            "token_configured": True,
            "token_masked": self._mask_token(bot_token),
            "api_base_url": api_base_url,
            "bot_id": bot_id,
            "username": username_raw or None,
            "first_name": first_name_raw or None,
            "display_name": display_name or None,
            "checked_with_override": checked_with_override,
        }

    def send_telegram_test_to_admin(
        self,
        *,
        platform_settings: PlatformSetting,
        admin_telegram_chat_id: str,
        telegram_api_base_url: str | None = None,
        telegram_bot_token: str | None = None,
        initiated_by_email: str | None = None,
    ) -> dict[str, Any]:
        normalized_chat_id = admin_telegram_chat_id.strip()
        if not normalized_chat_id:
            raise ValueError("Укажите Telegram chat ID администратора.")

        bot_info = self.inspect_telegram_bot(
            platform_settings=platform_settings,
            telegram_api_base_url=telegram_api_base_url,
            telegram_bot_token=telegram_bot_token,
        )
        bot_token, api_base_url, _ = self._resolve_telegram_transport(
            platform_settings=platform_settings,
            telegram_api_base_url=telegram_api_base_url,
            telegram_bot_token=telegram_bot_token,
        )

        initiated_line = (
            f"Инициатор: {initiated_by_email.strip()}"
            if initiated_by_email and initiated_by_email.strip()
            else "Инициатор: system"
        )
        text = "\n".join(
            [
                "Тестовое Telegram-уведомление NorenCash.",
                f"Время (UTC): {datetime.now(timezone.utc).isoformat()}",
                initiated_line,
            ]
        )
        try:
            response = requests.post(
                f"{api_base_url}/bot{bot_token}/sendMessage",
                json={
                    "chat_id": normalized_chat_id,
                    "text": text,
                    "disable_web_page_preview": True,
                },
                timeout=8,
            )
        except Exception as exc:
            raise ValueError(f"Не удалось отправить тестовое сообщение: {exc}") from exc

        if response.status_code >= 400:
            raise ValueError(
                f"Telegram API вернул HTTP {response.status_code} при отправке: {response.text[:240]}"
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise ValueError("Telegram API вернул невалидный JSON при отправке сообщения.") from exc

        if not isinstance(payload, dict) or payload.get("ok") is not True:
            description = ""
            if isinstance(payload, dict):
                description = str(payload.get("description") or "").strip()
            raise ValueError(description or "Telegram API отклонил отправку тестового сообщения.")

        message_id = None
        result = payload.get("result")
        if isinstance(result, dict):
            raw_message_id = result.get("message_id")
            if isinstance(raw_message_id, int):
                message_id = raw_message_id

        return {
            "ok": True,
            "chat_id": normalized_chat_id,
            "api_base_url": api_base_url,
            "bot_username": bot_info.get("username"),
            "bot_display_name": bot_info.get("display_name"),
            "telegram_message_id": message_id,
        }

    def send_smtp_bz_test_email(
        self,
        *,
        platform_settings: PlatformSetting,
        test_recipient_email: str,
        smtp_bz_api_base_url: str | None = None,
        smtp_bz_sender_email: str | None = None,
        smtp_bz_sender_name: str | None = None,
        smtp_bz_reply_to: str | None = None,
        smtp_bz_tag: str | None = None,
        smtp_bz_api_key: str | None = None,
        initiated_by_email: str | None = None,
    ) -> dict[str, Any]:
        recipient_email = (test_recipient_email or "").strip()
        if not recipient_email or "@" not in recipient_email:
            raise ValueError("Укажите корректный email для тестового сообщения.")

        api_base_url = self._normalize_smtp_bz_api_base_url(
            smtp_bz_api_base_url
            if smtp_bz_api_base_url is not None
            else platform_settings.smtp_bz_api_base_url
        )
        sender_email = (
            (smtp_bz_sender_email or "").strip()
            if smtp_bz_sender_email is not None
            else (platform_settings.smtp_bz_sender_email or "").strip()
        )
        if not sender_email or "@" not in sender_email:
            raise ValueError("Укажите корректный email отправителя SMTP.bz.")
        sender_name = (
            (smtp_bz_sender_name or "").strip()
            if smtp_bz_sender_name is not None
            else (platform_settings.smtp_bz_sender_name or "").strip()
        ) or "NorenCash"
        reply_to = (
            (smtp_bz_reply_to or "").strip()
            if smtp_bz_reply_to is not None
            else (platform_settings.smtp_bz_reply_to or "").strip()
        )
        if reply_to and "@" not in reply_to:
            raise ValueError("Reply-To указан некорректно.")
        tag = (
            (smtp_bz_tag or "").strip()
            if smtp_bz_tag is not None
            else (platform_settings.smtp_bz_tag or "").strip()
        )
        api_key_override = (smtp_bz_api_key or "").strip()
        api_key = api_key_override if api_key_override else self._get_smtp_bz_api_key(platform_settings)
        if not api_key:
            raise ValueError("Укажите API-ключ SMTP.bz.")

        initiated_line = (
            f"Инициатор: {initiated_by_email.strip()}"
            if initiated_by_email and initiated_by_email.strip()
            else "Инициатор: system"
        )
        subject = "NorenCash SMTP.bz test"
        text_body = "\n".join(
            [
                "Тестовое сообщение SMTP.bz от NorenCash.",
                f"Время (UTC): {datetime.now(timezone.utc).isoformat()}",
                initiated_line,
            ]
        )
        html_body = "".join(f"<p>{escape(line)}</p>" for line in text_body.split("\n"))

        request_parts: list[tuple[str, tuple[None, str]]] = [
            ("from", (None, sender_email)),
            ("name", (None, sender_name)),
            ("subject", (None, subject)),
            ("to", (None, recipient_email)),
            ("html", (None, html_body)),
            ("text", (None, text_body)),
        ]
        if reply_to:
            request_parts.append(("reply", (None, reply_to)))
        if tag:
            request_parts.append(("tag", (None, tag)))

        try:
            response = requests.post(
                f"{api_base_url}/smtp/send",
                headers={
                    "Authorization": api_key,
                    "accept": "application/json",
                },
                files=request_parts,
                timeout=12,
            )
        except Exception as exc:
            raise ValueError(f"Не удалось выполнить запрос к SMTP.bz: {exc}") from exc

        response_payload: Any = None
        if "application/json" in (response.headers.get("content-type") or "").lower():
            try:
                response_payload = response.json()
            except ValueError:
                response_payload = None

        if response.status_code >= 400:
            raise ValueError(
                f"SMTP.bz API вернул HTTP {response.status_code}: {(response.text or '')[:240]}"
            )

        if isinstance(response_payload, dict) and response_payload.get("result") is False:
            raise ValueError(
                f"SMTP.bz отклонил отправку: {json.dumps(response_payload, ensure_ascii=False)[:240]}"
            )

        return {
            "ok": True,
            "smtp_bz_api_base_url": api_base_url,
            "sender_email": sender_email,
            "sender_name": sender_name,
            "recipient_email": recipient_email,
            "tag": tag or None,
        }

    def _send_email(
        self,
        *,
        platform_settings: PlatformSetting,
        to_email: str,
        subject: str,
        lines: list[str],
        html_body: str | None = None,
    ) -> None:
        if not platform_settings.smtp_bz_enabled:
            return

        api_key = self._get_smtp_bz_api_key(platform_settings)
        if not api_key:
            logger.warning("SMTP.bz is enabled but API key is missing. Skip email notification.")
            return

        from_email = (platform_settings.smtp_bz_sender_email or "").strip()
        if not from_email:
            logger.warning("SMTP.bz sender email is empty. Skip email notification.")
            return

        normalized_to_email = to_email.strip()
        if not normalized_to_email:
            return

        sender_name = (platform_settings.smtp_bz_sender_name or "").strip() or "NorenCash"
        reply_to = (platform_settings.smtp_bz_reply_to or "").strip()
        tag = (platform_settings.smtp_bz_tag or "").strip()
        try:
            api_base_url = self._normalize_smtp_bz_api_base_url(
                platform_settings.smtp_bz_api_base_url
            )
        except ValueError:
            logger.warning("SMTP.bz API URL is invalid. Skip email notification.")
            return
        normalized_subject = subject.strip() or "Уведомление платформы"
        text_body = "\n".join(lines)
        resolved_html_body = html_body if html_body and html_body.strip() else "".join(
            f"<p>{escape(line)}</p>" for line in lines
        )
        request_parts: list[tuple[str, tuple[None, str]]] = [
            ("from", (None, from_email)),
            ("name", (None, sender_name)),
            ("subject", (None, normalized_subject)),
            ("to", (None, normalized_to_email)),
            ("html", (None, resolved_html_body)),
            ("text", (None, text_body)),
        ]
        if reply_to:
            request_parts.append(("reply", (None, reply_to)))
        if tag:
            request_parts.append(("tag", (None, tag)))

        try:
            response = requests.post(
                f"{api_base_url}/smtp/send",
                headers={
                    "Authorization": api_key,
                    "accept": "application/json",
                },
                files=request_parts,
                timeout=10,
            )
            response_payload: Any = None
            if "application/json" in (response.headers.get("content-type") or "").lower():
                try:
                    response_payload = response.json()
                except ValueError:
                    response_payload = None

            if response.status_code >= 400:
                logger.warning(
                    "SMTP.bz API error %s: %s",
                    response.status_code,
                    (response.text or "")[:240],
                )
                return
            if isinstance(response_payload, dict) and response_payload.get("result") is False:
                logger.warning(
                    "SMTP.bz rejected email send: %s",
                    json.dumps(response_payload, ensure_ascii=False)[:240],
                )
        except Exception:
            logger.exception("Failed to send email notification via SMTP.bz API.")

    def _get_smtp_bz_api_key(self, platform_settings: PlatformSetting) -> str:
        encrypted = (platform_settings.smtp_bz_api_key_encrypted or "").strip()
        if not encrypted:
            return ""
        try:
            return decrypt_value(encrypted).strip()
        except ValueError:
            logger.warning(
                "SMTP.bz API key cannot be decrypted. Re-save API key in admin settings."
            )
            return ""

    @classmethod
    def _normalize_smtp_bz_api_base_url(cls, raw_value: str | None) -> str:
        normalized = (raw_value or "").strip().rstrip("/")
        if not normalized:
            normalized = cls.DEFAULT_SMTP_BZ_API_BASE_URL
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("SMTP.bz API URL указан некорректно.")
        return normalized

    def _get_telegram_bot_token(self, platform_settings: PlatformSetting) -> str:
        encrypted = (platform_settings.telegram_bot_token_encrypted or "").strip()
        if not encrypted:
            return ""
        try:
            return decrypt_value(encrypted).strip()
        except ValueError:
            logger.warning(
                "Telegram bot token cannot be decrypted. Re-save token in admin settings."
            )
            return ""

    @classmethod
    def _normalize_telegram_api_base_url(cls, raw_value: str | None) -> str:
        normalized = (raw_value or "").strip().rstrip("/")
        if not normalized:
            normalized = cls.DEFAULT_TELEGRAM_API_BASE_URL
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Telegram API URL указан некорректно.")
        return normalized

    @staticmethod
    def _validate_public_url(raw_value: str, error_message: str) -> None:
        parsed = urlparse(raw_value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError(error_message)

    @classmethod
    def _render_template(cls, template: str, context: dict[str, str]) -> str:
        if not template:
            return ""

        def repl(match: re.Match[str]) -> str:
            key = match.group(1).strip()
            return str(context.get(key, ""))

        return re.sub(r"{{\s*([a-zA-Z0-9_]+)\s*}}", repl, template).strip()

    @staticmethod
    def _strip_html(raw_html: str) -> str:
        without_tags = re.sub(r"<[^>]+>", "", raw_html)
        normalized_lines = [
            line.strip() for line in without_tags.replace("\r", "").split("\n") if line.strip()
        ]
        return "\n".join(normalized_lines)

    @staticmethod
    def _wrap_email_html(
        *,
        body_html: str,
        brand_name: str,
        logo_url: str | None,
        brand_url: str | None,
    ) -> str:
        logo_markup = ""
        if logo_url:
            logo_markup = (
                '<div style="margin-bottom:18px;">'
                f'<img src="{escape(logo_url)}" alt="{escape(brand_name)}" '
                'style="max-height:44px;max-width:220px;display:block;" />'
                "</div>"
            )
        footer_markup = ""
        if brand_url:
            footer_markup = (
                '<p style="margin-top:20px;font-size:12px;color:#6f7d95;">'
                f'<a href="{escape(brand_url)}" style="color:#2f6bff;text-decoration:none;">'
                f"{escape(brand_url)}</a></p>"
            )
        return (
            '<div style="font-family:Arial,sans-serif;line-height:1.55;color:#101828;">'
            f"{logo_markup}{body_html}{footer_markup}</div>"
        )

    def _resolve_telegram_transport(
        self,
        *,
        platform_settings: PlatformSetting,
        telegram_api_base_url: str | None,
        telegram_bot_token: str | None,
    ) -> tuple[str, str, bool]:
        normalized_override_token = (
            telegram_bot_token.strip() if telegram_bot_token is not None else ""
        )
        normalized_token = (
            normalized_override_token
            if normalized_override_token
            else self._get_telegram_bot_token(platform_settings)
        )
        if telegram_api_base_url is not None and telegram_api_base_url.strip():
            normalized_api_base_url = self._normalize_telegram_api_base_url(telegram_api_base_url)
        else:
            normalized_api_base_url = self._normalize_telegram_api_base_url(
                platform_settings.telegram_api_base_url
            )
        checked_with_override = bool(normalized_override_token)
        return normalized_token, normalized_api_base_url, checked_with_override

    @staticmethod
    def _mask_token(token: str) -> str | None:
        normalized = token.strip()
        if not normalized:
            return None
        if len(normalized) <= 8:
            return f"{normalized[:2]}***"
        return f"{normalized[:6]}...{normalized[-4:]}"

    @staticmethod
    def _mask_secret(secret: str) -> str | None:
        normalized = secret.strip()
        if not normalized:
            return None
        if len(normalized) <= 10:
            return f"{normalized[:2]}***"
        return f"{normalized[:4]}...{normalized[-4:]}"

    def _send_telegram(
        self,
        *,
        platform_settings: PlatformSetting,
        chat_id: str,
        message_text: str,
    ) -> None:
        bot_token = self._get_telegram_bot_token(platform_settings)
        if not bot_token:
            logger.warning("Telegram notifications are enabled but bot token is empty.")
            return

        try:
            base_url = self._normalize_telegram_api_base_url(
                platform_settings.telegram_api_base_url
            )
        except ValueError:
            logger.warning("Telegram API base URL is invalid. Skip telegram notification.")
            return
        url = f"{base_url}/bot{bot_token}/sendMessage"
        text = (message_text or "").strip()
        if not text:
            return
        try:
            response = requests.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "disable_web_page_preview": True,
                },
                timeout=8,
            )
            if response.status_code >= 400:
                logger.warning(
                    "Telegram API error %s: %s",
                    response.status_code,
                    response.text[:240],
                )
                return
            content_type = (response.headers.get("content-type") or "").lower()
            if "application/json" in content_type:
                try:
                    payload = response.json()
                except ValueError:
                    payload = None
                if isinstance(payload, dict) and payload.get("ok") is False:
                    logger.warning(
                        "Telegram API rejected message: %s",
                        json.dumps(payload, ensure_ascii=False)[:240],
                    )
        except Exception:
            logger.exception("Failed to send telegram notification.")


