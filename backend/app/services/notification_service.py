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

TELEGRAM_BOT_TOKEN_PATTERN = re.compile(r"^\d{8,}:[A-Za-z0-9_-]{20,}$")


@dataclass(frozen=True)
class NotificationEventDefinition:
    code: str
    title: str
    mode: str


@dataclass(frozen=True)
class NotificationTemplatePayload:
    email_subject: str | None
    message_lines: str | None
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
        "notification_logo_url",
        "utc_now",
        "initiated_by_email",
        "tenant_name",
        "project_id",
        "project_name",
        "owner_email",
        "temporary_password",
        "recovery_token",
        "api_secret_key",
        "api_public_key",
        "invite_token",
        "payout_id",
        "payout_amount",
        "payout_currency",
        "payout_status",
        "destination_address",
        "review_comment",
    )
    DEFAULT_TEMPLATE: dict[str, str] = {
        "email_subject": "{{ event_subject }}",
        "message_lines": "{{ message_lines }}",
        "email_body": "{{ message_lines_html }}",
        "telegram_body": "{{ event_subject }}\n\n{{ message_lines }}",
    }
    DEFAULT_EMAIL_SUBJECT_BY_EVENT: dict[str, str] = {
        EVENT_APPLICATION_SUBMITTED: "{{ brand_name }}: заявка на подключение получена",
        EVENT_APPLICATION_APPROVED: "{{ brand_name }}: проект одобрен",
        EVENT_APPLICATION_REJECTED: "{{ brand_name }}: заявка отклонена",
        EVENT_PASSWORD_GENERATED: "{{ brand_name }}: данные для входа",
        EVENT_PASSWORD_CHANGED: "{{ brand_name }}: пароль изменён",
        EVENT_API_KEY_GENERATED: "{{ brand_name }}: новый API-ключ",
        EVENT_API_KEY_REGENERATED: "{{ brand_name }}: API-ключ перевыпущен",
        EVENT_API_KEY_REVOKED: "{{ brand_name }}: API-ключ отозван",
        EVENT_TWO_FACTOR_ENABLED: "{{ brand_name }}: двухфакторная защита включена",
        EVENT_TWO_FACTOR_DISABLED: "{{ brand_name }}: двухфакторная защита отключена",
        EVENT_PAYOUT_REQUESTED: "{{ brand_name }}: запрос на выплату создан",
        EVENT_PAYOUT_APPROVED: "{{ brand_name }}: выплата одобрена",
        EVENT_PAYOUT_REJECTED: "{{ brand_name }}: выплата отклонена",
    }
    DEFAULT_MESSAGE_LINES_BY_EVENT: dict[str, str] = {
        EVENT_APPLICATION_SUBMITTED: (
            "Здравствуйте, {{ user_full_name }}!\n"
            "Мы получили заявку на подключение проекта «{{ tenant_name }}».\n"
            "Сейчас она на модерации — сообщим результат отдельным письмом."
        ),
        EVENT_APPLICATION_APPROVED: (
            "Здравствуйте, {{ user_full_name }}!\n"
            "Проект «{{ tenant_name }}» одобрен.\n"
            "Можно входить в кабинет и продолжать настройку интеграции."
        ),
        EVENT_APPLICATION_REJECTED: (
            "Здравствуйте, {{ user_full_name }}!\n"
            "Заявка проекта «{{ tenant_name }}» отклонена.\n"
            "Комментарий модератора: {{ review_comment }}"
        ),
        EVENT_PASSWORD_GENERATED: (
            "Здравствуйте, {{ user_full_name }}!\n"
            "Email для входа: {{ user_email }}\n"
            "Временный пароль: {{ temporary_password }}{{ recovery_token }}\n"
            "После первого входа рекомендуем сразу сменить пароль."
        ),
        EVENT_PASSWORD_CHANGED: (
            "Здравствуйте, {{ user_full_name }}!\n"
            "Пароль для {{ user_email }} успешно обновлён.\n"
            "Если это были не вы, срочно обратитесь в поддержку."
        ),
        EVENT_API_KEY_GENERATED: (
            "Project ID: {{ project_id }}\n"
            "Public key: {{ api_public_key }}\n"
            "Secret key: {{ api_secret_key }}\n"
            "Invite token: {{ invite_token }}\n"
            "Сохраните secret key в защищённом месте."
        ),
        EVENT_API_KEY_REGENERATED: (
            "Public key: {{ api_public_key }}\n"
            "Secret key: {{ api_secret_key }}\n"
            "Инициатор: {{ initiated_by_email }}\n"
            "Сохраните новый secret key в защищённом месте."
        ),
        EVENT_API_KEY_REVOKED: (
            "Public key: {{ api_public_key }}\n"
            "Инициатор: {{ initiated_by_email }}\n"
            "Если отзыв был несанкционированным, срочно свяжитесь с поддержкой."
        ),
        EVENT_TWO_FACTOR_ENABLED: (
            "Здравствуйте, {{ user_full_name }}!\n"
            "Для {{ user_email }} включена двухфакторная защита входа."
        ),
        EVENT_TWO_FACTOR_DISABLED: (
            "Здравствуйте, {{ user_full_name }}!\n"
            "Для {{ user_email }} двухфакторная защита отключена.\n"
            "Если это были не вы, срочно смените пароль."
        ),
        EVENT_PAYOUT_REQUESTED: (
            "Создан запрос на выплату {{ payout_id }}.\n"
            "Сумма: {{ payout_amount }} {{ payout_currency }}\n"
            "Адрес: {{ destination_address }}\n"
            "Инициатор: {{ initiated_by_email }}"
        ),
        EVENT_PAYOUT_APPROVED: (
            "Выплата {{ payout_id }} одобрена.\n"
            "Сумма: {{ payout_amount }} {{ payout_currency }}\n"
            "Статус: {{ payout_status }}\n"
            "Комментарий: {{ review_comment }}"
        ),
        EVENT_PAYOUT_REJECTED: (
            "Выплата {{ payout_id }} отклонена.\n"
            "Сумма: {{ payout_amount }} {{ payout_currency }}\n"
            "Статус: {{ payout_status }}\n"
            "Комментарий: {{ review_comment }}"
        ),
    }

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
        views: list[dict[str, Any]] = []
        for definition in self.EVENT_DEFINITIONS:
            default_template = self._default_template_for(definition)
            editor_default_message_lines = self._default_message_lines_for(definition)
            stored_template = template_map.get(definition.code, {})
            views.append(
                {
                "code": definition.code,
                "title": definition.title,
                "mode": definition.mode,
                    "email_subject": stored_template.get("email_subject"),
                    "message_lines": stored_template.get("message_lines") or editor_default_message_lines,
                    "email_body": stored_template.get("email_body"),
                    "telegram_body": stored_template.get("telegram_body"),
                    "default_email_subject": default_template["email_subject"],
                    "default_message_lines": editor_default_message_lines,
                    "default_email_body": default_template["email_body"],
                    "default_telegram_body": default_template["telegram_body"],
                    "configured": bool(stored_template),
                }
            )
        return views

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
            if normalized_telegram_bot_token:
                self._validate_telegram_bot_token_format(normalized_telegram_bot_token)
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
        context: dict[str, Any] | None = None,
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
            extra_context=context,
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
        context: dict[str, Any] | None = None,
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
                context=context,
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
            message_lines = str(raw_template.get("message_lines") or "").strip()
            email_body = str(raw_template.get("email_body") or "").strip()
            telegram_body = str(raw_template.get("telegram_body") or "").strip()
            if not any([email_subject, message_lines, email_body, telegram_body]):
                continue
            normalized[code] = {
                "email_subject": email_subject,
                "message_lines": message_lines,
                "email_body": email_body,
                "telegram_body": telegram_body,
            }
        return normalized

    @classmethod
    def _default_email_subject_for(cls, definition: NotificationEventDefinition) -> str:
        return cls.DEFAULT_EMAIL_SUBJECT_BY_EVENT.get(
            definition.code,
            cls.DEFAULT_TEMPLATE["email_subject"],
        )

    @classmethod
    def _default_template_for(cls, definition: NotificationEventDefinition) -> dict[str, str]:
        return {
            "email_subject": cls._default_email_subject_for(definition),
            "message_lines": cls.DEFAULT_TEMPLATE["message_lines"],
            "email_body": cls.DEFAULT_TEMPLATE["email_body"],
            "telegram_body": cls.DEFAULT_TEMPLATE["telegram_body"],
        }

    @classmethod
    def _default_message_lines_for(cls, definition: NotificationEventDefinition) -> str:
        return cls.DEFAULT_MESSAGE_LINES_BY_EVENT.get(
            definition.code,
            cls.DEFAULT_TEMPLATE["message_lines"],
        )

    @classmethod
    def _normalize_templates(cls, templates: Iterable[Any]) -> dict[str, dict[str, str]]:
        normalized: dict[str, dict[str, str]] = {}
        for item in templates:
            code_raw = getattr(item, "code", None)
            code = str(code_raw or "").strip()
            if code not in cls.EVENT_DEFINITION_BY_CODE:
                continue
            email_subject = str(getattr(item, "email_subject", "") or "").strip()
            message_lines = str(getattr(item, "message_lines", "") or "").strip()
            email_body = str(getattr(item, "email_body", "") or "").strip()
            telegram_body = str(getattr(item, "telegram_body", "") or "").strip()
            if not any([email_subject, message_lines, email_body, telegram_body]):
                continue
            normalized[code] = {
                "email_subject": email_subject,
                "message_lines": message_lines,
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
        template_override: dict[str, str | None] | None = None,
        extra_context: dict[str, Any] | None = None,
    ) -> RenderedNotificationPayload:
        definition = self.EVENT_DEFINITION_BY_CODE[event_code]
        template_map = self._parse_template_map(platform_settings.notification_templates_json)
        default_template = self._default_template_for(definition)
        template = {**default_template, **template_map.get(event_code, {})}
        if template_override is not None:
            for key in ("email_subject", "message_lines", "email_body", "telegram_body"):
                if key in template_override:
                    value = template_override.get(key)
                    template[key] = str(value or "").strip() or default_template[key]
        normalized_subject = fallback_subject.strip() or definition.title
        message_lines = [line.strip() for line in fallback_lines if line.strip()]
        if not message_lines:
            message_lines = [normalized_subject]
        message_lines_text = "\n".join(message_lines)
        message_lines_html = "".join(f"<p>{escape(line)}</p>" for line in message_lines)

        context = self._build_template_context(
            platform_settings=platform_settings,
            user=user,
            event_code=event_code,
            fallback_subject=normalized_subject,
            fallback_lines=message_lines,
            extra_context=extra_context,
        )

        rendered_subject = self._render_template(
            str(template.get("email_subject") or "").strip() or normalized_subject,
            context,
        )
        rendered_message_lines = self._render_template(
            str(template.get("message_lines") or "").strip(),
            context,
        )
        if rendered_message_lines:
            message_lines_text = rendered_message_lines
            message_lines = [
                line.strip()
                for line in rendered_message_lines.replace("\r", "").split("\n")
                if line.strip()
            ]
            message_lines_html = "".join(f"<p>{escape(line)}</p>" for line in message_lines)
            context["message_lines"] = message_lines_text
            context["message_lines_html"] = message_lines_html
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

    def preview_notification_template(
        self,
        *,
        platform_settings: PlatformSetting,
        event_code: str,
        email_subject: str | None = None,
        message_lines: str | None = None,
        email_body: str | None = None,
        telegram_body: str | None = None,
        sample_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if event_code not in self.EVENT_DEFINITION_BY_CODE:
            raise ValueError("Неизвестный код события уведомления.")
        definition = self.EVENT_DEFINITION_BY_CODE[event_code]
        user = User(
            email=str((sample_context or {}).get("user_email") or "merchant@example.com"),
            full_name=str((sample_context or {}).get("user_full_name") or "Merchant Owner"),
        )
        sample_lines = [
            "Это пример строки уведомления.",
            "Замените шаблон и переменные под свой сценарий.",
        ]
        context = {
            "initiated_by_email": "admin@example.com",
            "tenant_name": "Demo Merchant",
            "project_id": "project_demo",
            "project_name": "Demo Checkout",
            "owner_email": user.email,
            "temporary_password": "DemoPass-123",
            "recovery_token": "recover_demo_token",
            "api_public_key": "pk_demo_public",
            "api_secret_key": "sk_demo_secret",
            "invite_token": "invite_demo_token",
            "payout_id": "payout_demo",
            "payout_amount": "100.00",
            "payout_currency": "USDT",
            "payout_status": "approved",
            "destination_address": "TQdemoAddress123",
            "review_comment": "Тестовый комментарий",
            **(sample_context or {}),
        }
        rendered = self._render_notification_payload(
            platform_settings=platform_settings,
            user=user,
            event_code=event_code,
            fallback_subject=definition.title,
            fallback_lines=sample_lines,
            template_override={
                "email_subject": email_subject,
                "message_lines": message_lines,
                "email_body": email_body,
                "telegram_body": telegram_body,
            },
            extra_context=context,
        )
        variables = self._build_template_context(
            platform_settings=platform_settings,
            user=user,
            event_code=event_code,
            fallback_subject=definition.title,
            fallback_lines=sample_lines,
            extra_context=context,
        )
        rendered_message_lines = self._render_template(
            str(message_lines or "").strip(),
            variables,
        )
        if rendered_message_lines:
            variables["message_lines"] = rendered_message_lines
            variables["message_lines_html"] = "".join(
                f"<p>{escape(line.strip())}</p>"
                for line in rendered_message_lines.replace("\r", "").split("\n")
                if line.strip()
            )
        return {
            "code": event_code,
            "title": definition.title,
            "email_subject": rendered.email_subject,
            "email_text": rendered.email_text,
            "email_html": rendered.email_html,
            "telegram_text": rendered.telegram_text,
            "variables": variables,
        }

    def _build_template_context(
        self,
        *,
        platform_settings: PlatformSetting,
        user: User,
        event_code: str,
        fallback_subject: str,
        fallback_lines: list[str],
        extra_context: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        definition = self.EVENT_DEFINITION_BY_CODE[event_code]
        message_lines = [line.strip() for line in fallback_lines if line.strip()]
        if not message_lines:
            message_lines = [fallback_subject.strip() or definition.title]
        message_lines_text = "\n".join(message_lines)
        message_lines_html = "".join(f"<p>{escape(line)}</p>" for line in message_lines)
        context: dict[str, str] = {
            "event_code": event_code,
            "event_title": definition.title,
            "event_subject": fallback_subject.strip() or definition.title,
            "message_lines": message_lines_text,
            "message_lines_html": message_lines_html,
            "user_email": (user.email or "").strip(),
            "user_full_name": (user.full_name or "").strip(),
            "brand_name": (platform_settings.notification_brand_name or "").strip() or "NorenCash",
            "brand_url": (platform_settings.notification_primary_url or "").strip(),
            "notification_logo_url": (platform_settings.notification_logo_url or "").strip(),
            "utc_now": datetime.now(timezone.utc).isoformat(),
        }
        context.update(self._infer_template_context_from_lines(message_lines))
        for key, value in (extra_context or {}).items():
            safe_key = str(key or "").strip()
            if not safe_key:
                continue
            context[safe_key] = "" if value is None else str(value)
        return context

    @staticmethod
    def _infer_template_context_from_lines(lines: list[str]) -> dict[str, str]:
        inferred: dict[str, str] = {}
        for line in lines:
            if ":" not in line:
                continue
            raw_label, raw_value = line.split(":", 1)
            label = raw_label.strip().lower()
            value = raw_value.strip()
            if not value:
                continue
            if label in {"проект"}:
                inferred.setdefault("tenant_name", value)
                inferred.setdefault("project_name", value)
            elif label == "project id":
                inferred.setdefault("project_id", value)
            elif label == "public key":
                inferred.setdefault("api_public_key", value)
            elif label == "secret key":
                inferred.setdefault("api_secret_key", value)
            elif label == "invite token":
                inferred.setdefault("invite_token", value)
            elif label in {"email", "пользователь"}:
                inferred.setdefault("user_email", value)
                inferred.setdefault("owner_email", value)
            elif label == "временный пароль":
                inferred.setdefault("temporary_password", value)
            elif label == "токен восстановления":
                inferred.setdefault("recovery_token", value)
            elif label == "payout id":
                inferred.setdefault("payout_id", value)
            elif label == "сумма":
                amount_parts = value.split()
                inferred.setdefault("payout_amount", amount_parts[0] if amount_parts else value)
                if len(amount_parts) > 1:
                    inferred.setdefault("payout_currency", amount_parts[1])
            elif label == "адрес":
                inferred.setdefault("destination_address", value)
            elif label == "инициатор":
                inferred.setdefault("initiated_by_email", value)
            elif label == "статус":
                inferred.setdefault("payout_status", value)
            elif label == "комментарий":
                inferred.setdefault("review_comment", value)
        return inferred

    def send_notification_template_test(
        self,
        *,
        platform_settings: PlatformSetting,
        event_code: str,
        test_recipient_email: str | None = None,
        telegram_chat_id: str | None = None,
        email_subject: str | None = None,
        message_lines: str | None = None,
        email_body: str | None = None,
        telegram_body: str | None = None,
        sample_context: dict[str, Any] | None = None,
        smtp_bz_api_key: str | None = None,
        telegram_bot_token: str | None = None,
    ) -> dict[str, Any]:
        rendered = self.preview_notification_template(
            platform_settings=platform_settings,
            event_code=event_code,
            email_subject=email_subject,
            message_lines=message_lines,
            email_body=email_body,
            telegram_body=telegram_body,
            sample_context=sample_context,
        )
        email_sent = False
        telegram_sent = False
        recipient = (test_recipient_email or "").strip()
        if recipient:
            if "@" not in recipient:
                raise ValueError("Укажите корректный email для тестового шаблона.")
            sender_email = (platform_settings.smtp_bz_sender_email or "").strip()
            if not sender_email or "@" not in sender_email:
                raise ValueError("Укажите корректный email отправителя SMTP.bz.")
            api_key_override = (smtp_bz_api_key or "").strip()
            api_key = api_key_override if api_key_override else self._get_smtp_bz_api_key(platform_settings)
            if not api_key:
                raise ValueError("Укажите API-ключ SMTP.bz для тестовой отправки шаблона.")
            request_parts: list[tuple[str, tuple[None, str]]] = [
                ("from", (None, sender_email)),
                ("name", (None, (platform_settings.smtp_bz_sender_name or "").strip() or "NorenCash")),
                ("subject", (None, str(rendered["email_subject"]))),
                ("to", (None, recipient)),
                ("html", (None, str(rendered["email_html"]))),
                ("text", (None, str(rendered["email_text"]))),
            ]
            reply_to = (platform_settings.smtp_bz_reply_to or "").strip()
            if reply_to:
                request_parts.append(("reply", (None, reply_to)))
            tag = (platform_settings.smtp_bz_tag or "").strip()
            if tag:
                request_parts.append(("tag", (None, tag)))
            try:
                response = requests.post(
                    f"{self._normalize_smtp_bz_api_base_url(platform_settings.smtp_bz_api_base_url)}/smtp/send",
                    headers={"Authorization": api_key, "accept": "application/json"},
                    files=request_parts,
                    timeout=12,
                )
            except Exception as exc:
                raise ValueError(f"Не удалось выполнить запрос к SMTP.bz: {exc}") from exc
            if response.status_code >= 400:
                raise ValueError(f"SMTP.bz API вернул HTTP {response.status_code}: {(response.text or '')[:240]}")
            email_sent = True
        chat_id = (telegram_chat_id or "").strip()
        if chat_id:
            bot_token, api_base_url, _ = self._resolve_telegram_transport(
                platform_settings=platform_settings,
                telegram_api_base_url=None,
                telegram_bot_token=telegram_bot_token,
            )
            if not bot_token:
                raise ValueError("Укажите Telegram Bot Token для тестовой отправки шаблона.")
            delivery = self._prepare_telegram_delivery(str(rendered["telegram_text"]))
            endpoint = str(delivery.get("endpoint") or "sendMessage")
            payload_body = {
                key: value
                for key, value in dict(delivery.get("payload") or {}).items()
                if value is not None
            }
            payload_body["chat_id"] = chat_id
            try:
                response = requests.post(
                    f"{api_base_url}/bot{bot_token}/{endpoint}",
                    json=payload_body,
                    timeout=8,
                )
            except Exception as exc:
                raise ValueError(f"Не удалось отправить тестовое сообщение: {exc}") from exc
            if response.status_code >= 400:
                raise ValueError(f"Telegram API вернул HTTP {response.status_code}: {response.text[:240]}")
            telegram_sent = True
        return {
            **rendered,
            "email_sent": email_sent,
            "telegram_sent": telegram_sent,
        }

    def is_smtp_bz_api_key_configured(self, platform_settings: PlatformSetting) -> bool:
        return bool((platform_settings.smtp_bz_api_key_encrypted or "").strip())

    def get_masked_smtp_bz_api_key(self, platform_settings: PlatformSetting) -> str | None:
        encrypted = (platform_settings.smtp_bz_api_key_encrypted or "").strip()
        if not encrypted:
            return None
        api_key = self._get_smtp_bz_api_key(platform_settings)
        return self._mask_secret(api_key) if api_key else "Stored"

    def is_telegram_bot_token_configured(self, platform_settings: PlatformSetting) -> bool:
        return bool(self._get_telegram_bot_token(platform_settings))

    def get_masked_telegram_bot_token(self, platform_settings: PlatformSetting) -> str | None:
        token = self._get_telegram_bot_token(platform_settings)
        return self._mask_token(token) if token else None

    @classmethod
    def _validate_telegram_bot_token_format(cls, token: str) -> None:
        normalized = token.strip()
        if not TELEGRAM_BOT_TOKEN_PATTERN.fullmatch(normalized):
            raise ValueError(
                "Формат токена неверный. Скопируйте полный токен из @BotFather "
                "(вид: 1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)."
            )

    @classmethod
    def _raise_telegram_api_error(cls, response: requests.Response, action: str) -> None:
        description = ""
        try:
            payload = response.json()
            if isinstance(payload, dict):
                description = str(payload.get("description") or "").strip()
        except ValueError:
            description = response.text[:240].strip()

        lowered = description.lower()
        if response.status_code == 401 or "unauthorized" in lowered or (
            "not found" in lowered and "token" in lowered
        ):
            raise ValueError(
                "Токен бота недействитен или отозван в Telegram. "
                "В @BotFather откройте бота → API Token → сгенерируйте новый токен, "
                "вставьте в поле «Новый токен бота», нажмите «Сохранить изменения» внизу раздела "
                "и снова «Проверить бота»."
            ) from None
        if response.status_code == 404:
            raise ValueError(
                "Telegram API URL недоступен (HTTP 404). Оставьте https://api.telegram.org "
                "или укажите корректный прокси."
            ) from None

        suffix = f": {description}" if description else ""
        raise ValueError(f"Telegram API отклонил запрос {action} (HTTP {response.status_code}){suffix}")

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
            encrypted = (platform_settings.telegram_bot_token_encrypted or "").strip()
            if encrypted:
                raise ValueError(
                    "Токен в базе не расшифровывается (возможно, сменился SECRET_KEY на сервере). "
                    "Вставьте новый токен из @BotFather в поле «Новый токен бота» и сохраните настройки."
                )
            raise ValueError(
                "Telegram Bot Token не настроен. Вставьте токен из @BotFather в поле «Новый токен бота»."
            )

        self._validate_telegram_bot_token_format(bot_token)

        try:
            response = requests.get(
                f"{api_base_url}/bot{bot_token}/getMe",
                timeout=8,
            )
        except Exception as exc:
            raise ValueError(f"Не удалось выполнить getMe: {exc}") from exc

        if response.status_code >= 400:
            self._raise_telegram_api_error(response, "getMe")

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
            self._raise_telegram_api_error(response, "sendMessage")

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

    @staticmethod
    def _looks_like_html_message(raw_value: str) -> bool:
        return "<" in raw_value and ">" in raw_value

    @classmethod
    def _extract_first_image_url(cls, raw_html: str) -> tuple[str | None, str]:
        pattern = re.compile(r"""<img[^>]+src=["']([^"']+)["']""", re.IGNORECASE)
        match = pattern.search(raw_html)
        if not match:
            return None, raw_html
        photo_url = match.group(1).strip()
        cleaned = pattern.sub("", raw_html, count=1)
        return photo_url or None, cleaned

    @classmethod
    def _html_to_telegram_html(cls, raw_html: str) -> str:
        text = raw_html
        replacements = [
            (r"<(strong|b)>(.*?)</\1>", r"<b>\2</b>"),
            (r"<(em|i)>(.*?)</\1>", r"<i>\2</i>"),
            (r"<u>(.*?)</u>", r"<u>\1</u>"),
            (r"<(strike|s)>(.*?)</\1>", r"<s>\2</s>"),
            (r"<br\s*/?>", "\n"),
            (r"</p>", "\n"),
            (r"<p[^>]*>", ""),
            (r"<li[^>]*>", "• "),
            (r"</li>", "\n"),
            (r"</?(ul|ol|blockquote|h[1-4]|div)[^>]*>", "\n"),
            (r"<hr\s*/?>", "\n———\n"),
            (r"<code>(.*?)</code>", r"\1"),
        ]
        for pattern, repl in replacements:
            text = re.sub(pattern, repl, text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", r'<a href="\1">\2</a>', text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def _prepare_telegram_delivery(cls, message_text: str) -> dict[str, Any]:
        text = (message_text or "").strip()
        if not text:
            return {"endpoint": "sendMessage", "payload": {}}
        if not cls._looks_like_html_message(text):
            return {
                "endpoint": "sendMessage",
                "payload": {
                    "text": text,
                    "disable_web_page_preview": True,
                },
            }
        photo_url, html_without_photo = cls._extract_first_image_url(text)
        caption = cls._html_to_telegram_html(html_without_photo)
        if photo_url:
            return {
                "endpoint": "sendPhoto",
                "payload": {
                    "photo": photo_url,
                    "caption": caption[:1024],
                    "parse_mode": "HTML" if caption else None,
                },
            }
        if caption:
            return {
                "endpoint": "sendMessage",
                "payload": {
                    "text": caption[:4096],
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            }
        return {
            "endpoint": "sendMessage",
            "payload": {
                "text": cls._strip_html(text)[:4096],
                "disable_web_page_preview": True,
            },
        }

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
        delivery = self._prepare_telegram_delivery(message_text)
        endpoint = delivery.get("endpoint") or "sendMessage"
        payload_body = dict(delivery.get("payload") or {})
        payload_body = {key: value for key, value in payload_body.items() if value is not None}
        if not payload_body.get("text") and not payload_body.get("caption") and not payload_body.get("photo"):
            return
        payload_body["chat_id"] = chat_id
        url = f"{base_url}/bot{bot_token}/{endpoint}"
        try:
            response = requests.post(
                url,
                json=payload_body,
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


