"""Служебный Telegram-чат платформы (forum/supergroup с топиками). Только для команды ops, не мерчантов."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable

import requests
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.payout_request import PayoutRequest
from app.models.platform_setting import PlatformSetting
from app.models.tenant import Tenant
from app.core.config import settings
from app.services.billing_policy_service import BillingPolicyService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OpsTopicDefinition:
    key: str
    title: str
    description: str


OPS_TOPIC_DEFINITIONS: tuple[OpsTopicDefinition, ...] = (
    OpsTopicDefinition(
        key="onboarding",
        title="📋 Заявки",
        description="Новые заявки на подключение, ожидают модерации.",
    ),
    OpsTopicDefinition(
        key="payouts",
        title="💸 Выплаты",
        description="Запросы, одобрения и отклонения выплат мерчантов.",
    ),
    OpsTopicDefinition(
        key="finance",
        title="💰 Платежи",
        description="Оплаченные и подтверждённые инвойсы, аномалии сумм.",
    ),
    OpsTopicDefinition(
        key="clients",
        title="👥 Клиенты",
        description="Одобрение/отклонение мерчантов, блокировки, сброс доступа.",
    ),
    OpsTopicDefinition(
        key="alerts",
        title="⚠️ Алерты",
        description="Ошибки провайдера, webhook, sync и rate-limit.",
    ),
    OpsTopicDefinition(
        key="security",
        title="🔐 Безопасность",
        description="2FA, сброс паролей админом, подозрительная активность.",
    ),
    OpsTopicDefinition(
        key="reports",
        title="📊 Отчёты",
        description="Ежедневные и еженедельные дайджесты по платформе.",
    ),
    OpsTopicDefinition(
        key="sandbox",
        title="🧪 Sandbox",
        description="Создание и жизненный цикл песочниц.",
    ),
    OpsTopicDefinition(
        key="partners",
        title="🤝 Партнёры",
        description="Заявки партнёров, атрибуция и выплаты affiliate.",
    ),
)

OPS_TOPIC_BY_KEY = {item.key: item for item in OPS_TOPIC_DEFINITIONS}

# General topic in Telegram forum supergroups (fallback when thread_id not configured).
FORUM_GENERAL_TOPIC_ID = 1

# Событие платформы → ключ топика.
EVENT_TOPIC_MAP: dict[str, str] = {
    "application_submitted": "onboarding",
    "application_approved": "clients",
    "application_rejected": "clients",
    "payout_requested": "payouts",
    "payout_approved": "payouts",
    "payout_rejected": "payouts",
    "invoice_paid": "finance",
    "invoice_confirmed": "finance",
    "provider_alert": "alerts",
    "tenant_password_reset": "security",
    "tenant_2fa_reset": "security",
    "sandbox_created": "sandbox",
    "sandbox_ready": "sandbox",
    "daily_report": "reports",
    "partner_application_submitted": "partners",
    "partner_application_approved": "partners",
    "partner_application_rejected": "partners",
    "partner_suspended": "partners",
    "partner_merchant_attributed": "partners",
    "partner_payout_requested": "partners",
    "partner_payout_approved": "partners",
    "partner_payout_rejected": "partners",
}


class PlatformOpsTelegramService:
    DEFAULT_EVENTS_JSON = json.dumps(sorted(EVENT_TOPIC_MAP.keys()), ensure_ascii=False)

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._notifications = NotificationService(db)

    @classmethod
    def topic_definitions(cls) -> list[OpsTopicDefinition]:
        return list(OPS_TOPIC_DEFINITIONS)

    def parse_topics(self, platform_settings: PlatformSetting) -> dict[str, dict[str, Any]]:
        raw = platform_settings.ops_telegram_topics_json or "{}"
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            parsed = {}
        if not isinstance(parsed, dict):
            return {}
        normalized: dict[str, dict[str, Any]] = {}
        for definition in OPS_TOPIC_DEFINITIONS:
            entry = parsed.get(definition.key)
            if isinstance(entry, dict):
                thread_id = entry.get("thread_id")
                enabled = bool(entry.get("enabled", True))
            elif isinstance(entry, int):
                thread_id = entry
                enabled = True
            else:
                thread_id = None
                enabled = True
            normalized[definition.key] = {
                "thread_id": int(thread_id) if thread_id is not None else None,
                "enabled": enabled,
            }
        return normalized

    def parse_enabled_events(self, platform_settings: PlatformSetting) -> set[str]:
        raw = platform_settings.ops_telegram_events_json or self.DEFAULT_EVENTS_JSON
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            parsed = []
        if not isinstance(parsed, list):
            return set(EVENT_TOPIC_MAP.keys())
        codes = {str(item).strip() for item in parsed if str(item).strip() in EVENT_TOPIC_MAP}
        return codes or set(EVENT_TOPIC_MAP.keys())

    def get_topic_views(self, platform_settings: PlatformSetting) -> list[dict[str, Any]]:
        topics = self.parse_topics(platform_settings)
        enabled_events = self.parse_enabled_events(platform_settings)
        views: list[dict[str, Any]] = []
        for definition in OPS_TOPIC_DEFINITIONS:
            topic_state = topics.get(definition.key, {})
            event_codes = [
                code for code, topic_key in EVENT_TOPIC_MAP.items() if topic_key == definition.key
            ]
            views.append(
                {
                    "key": definition.key,
                    "title": definition.title,
                    "description": definition.description,
                    "thread_id": topic_state.get("thread_id"),
                    "enabled": bool(topic_state.get("enabled", True)),
                    "event_codes": event_codes,
                    "events_enabled_count": sum(
                        1 for code in event_codes if code in enabled_events
                    ),
                }
            )
        return views

    def get_event_views(self, platform_settings: PlatformSetting) -> list[dict[str, Any]]:
        enabled_events = self.parse_enabled_events(platform_settings)
        views: list[dict[str, Any]] = []
        for code, topic_key in EVENT_TOPIC_MAP.items():
            topic = OPS_TOPIC_BY_KEY.get(topic_key)
            views.append(
                {
                    "code": code,
                    "topic_key": topic_key,
                    "topic_title": topic.title if topic else topic_key,
                    "enabled": code in enabled_events,
                }
            )
        return views

    async def update_settings(
        self,
        platform_settings: PlatformSetting,
        *,
        enabled: bool,
        chat_id: str | None,
        topics: Iterable[Any],
        event_toggles: Iterable[Any] | None = None,
    ) -> PlatformSetting:
        normalized_topics = self.parse_topics(platform_settings)
        for item in topics:
            key = str(getattr(item, "key", "") or "").strip()
            if key not in OPS_TOPIC_BY_KEY:
                continue
            thread_raw = getattr(item, "thread_id", None)
            thread_id: int | None
            if thread_raw is None or thread_raw == "":
                thread_id = None
            else:
                thread_id = int(thread_raw)
            topic_enabled = bool(getattr(item, "enabled", True))
            normalized_topics[key] = {"thread_id": thread_id, "enabled": topic_enabled}

        platform_settings.ops_telegram_enabled = bool(enabled)
        normalized_chat_id = (chat_id or "").strip()
        platform_settings.ops_telegram_chat_id = normalized_chat_id or None
        platform_settings.ops_telegram_topics_json = json.dumps(
            normalized_topics,
            ensure_ascii=False,
        )

        current_events = self.parse_enabled_events(platform_settings)
        if event_toggles is not None:
            next_events: set[str] = set()
            for item in event_toggles:
                code = str(getattr(item, "code", "") or "").strip()
                if code not in EVENT_TOPIC_MAP:
                    continue
                if bool(getattr(item, "enabled", False)):
                    next_events.add(code)
            platform_settings.ops_telegram_events_json = json.dumps(
                sorted(next_events),
                ensure_ascii=False,
            )
        else:
            platform_settings.ops_telegram_events_json = json.dumps(
                sorted(current_events),
                ensure_ascii=False,
            )

        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(platform_settings)
        return platform_settings

    def _is_configured(self, platform_settings: PlatformSetting) -> bool:
        return self._delivery_error(platform_settings, require_enabled=True) is None

    def _delivery_error(
        self,
        platform_settings: PlatformSetting,
        *,
        require_enabled: bool = True,
    ) -> str | None:
        if not self._notifications.is_telegram_bot_token_configured(platform_settings):
            return "Токен Telegram-бота не настроен (раздел «Telegram» в настройках платформы)."
        if not (platform_settings.ops_telegram_chat_id or "").strip():
            return "Укажите chat_id служебного форум-чата."
        if require_enabled and not platform_settings.ops_telegram_enabled:
            return "Включите переключатель «Служебные уведомления включены»."
        return None

    @staticmethod
    def _parse_telegram_error(response: requests.Response) -> str:
        try:
            body = response.json()
            if isinstance(body, dict):
                description = body.get("description")
                if isinstance(description, str) and description.strip():
                    return description.strip()
        except ValueError:
            pass
        text = (response.text or "").strip()
        if text:
            return text[:240]
        return f"HTTP {response.status_code}"

    def _resolve_thread_id(
        self,
        platform_settings: PlatformSetting,
        topic_key: str,
        *,
        thread_id_override: int | None = None,
    ) -> int | None:
        if thread_id_override is not None:
            return thread_id_override
        topics = self.parse_topics(platform_settings)
        state = topics.get(topic_key) or {}
        if not state.get("enabled", True):
            return None
        thread_id = state.get("thread_id")
        if thread_id is not None:
            return int(thread_id)
        return FORUM_GENERAL_TOPIC_ID

    def _topic_delivery_blocked(
        self,
        platform_settings: PlatformSetting,
        topic_key: str,
    ) -> str | None:
        topics = self.parse_topics(platform_settings)
        state = topics.get(topic_key) or {}
        if not state.get("enabled", True):
            return f"Топик «{topic_key}» отключён в настройках служебного чата."
        return None

    def send_to_topic(
        self,
        platform_settings: PlatformSetting,
        topic_key: str,
        message_text: str,
        *,
        disable_notification: bool = False,
        chat_id_override: str | None = None,
        thread_id_override: int | None = None,
        require_enabled: bool = True,
    ) -> tuple[int | None, str | None]:
        delivery_error = self._delivery_error(platform_settings, require_enabled=require_enabled)
        if delivery_error:
            return None, delivery_error
        if topic_key not in OPS_TOPIC_BY_KEY:
            logger.warning("Unknown ops telegram topic: %s", topic_key)
            return None, f"Неизвестный топик: {topic_key}"

        thread_id = self._resolve_thread_id(
            platform_settings,
            topic_key,
            thread_id_override=thread_id_override,
        )
        chat_id = (chat_id_override or platform_settings.ops_telegram_chat_id or "").strip()
        bot_token = self._notifications._get_telegram_bot_token(platform_settings)  # noqa: SLF001
        if not bot_token or not chat_id:
            return None, "Не задан chat_id или токен бота."

        try:
            base_url = self._notifications._normalize_telegram_api_base_url(  # noqa: SLF001
                platform_settings.telegram_api_base_url
            )
        except ValueError:
            logger.warning("Invalid Telegram API base URL for ops chat.")
            return None, "Некорректный Telegram API URL."

        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": message_text[:4096],
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "disable_notification": disable_notification,
        }
        if thread_id is not None:
            payload["message_thread_id"] = thread_id

        url = f"{base_url}/bot{bot_token}/sendMessage"
        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code >= 400:
                error_text = self._parse_telegram_error(response)
                logger.warning(
                    "Ops Telegram send failed %s: %s",
                    response.status_code,
                    error_text,
                )
                return None, error_text
            body = response.json()
            if not isinstance(body, dict) or body.get("ok") is not True:
                error_text = self._parse_telegram_error(response)
                logger.warning("Ops Telegram rejected message: %s", error_text)
                return None, error_text
            result = body.get("result")
            if isinstance(result, dict):
                message_id = result.get("message_id")
                return (int(message_id) if message_id is not None else None), None
        except Exception:
            logger.exception("Failed to send ops telegram message to topic %s", topic_key)
            return None, "Сетевая ошибка при обращении к Telegram API."
        return None, "Telegram не вернул message_id."

    async def notify_event(
        self,
        *,
        event_code: str,
        title: str,
        lines: list[str],
        admin_url: str | None = None,
    ) -> None:
        billing = BillingPolicyService(self.db)
        platform_settings = await billing.get_platform_settings()
        if not self._is_configured(platform_settings):
            delivery_error = self._delivery_error(platform_settings, require_enabled=True)
            logger.info(
                "Ops Telegram skip %s: %s",
                event_code,
                delivery_error or "not configured",
            )
            return
        if event_code not in EVENT_TOPIC_MAP:
            logger.warning("Ops Telegram skip unknown event: %s", event_code)
            return
        if event_code not in self.parse_enabled_events(platform_settings):
            logger.info("Ops Telegram skip %s: event disabled in settings", event_code)
            return

        topic_key = EVENT_TOPIC_MAP[event_code]
        topic_block = self._topic_delivery_blocked(platform_settings, topic_key)
        if topic_block:
            logger.info("Ops Telegram skip %s: %s", event_code, topic_block)
            return

        body_lines = [f"<b>{self._escape_html(title)}</b>"]
        body_lines.extend(self._escape_html(line) for line in lines if line.strip())
        link = self._resolve_admin_link(platform_settings, admin_url)
        if link:
            safe_url = self._escape_html(link)
            body_lines.append(f'<a href="{safe_url}">Открыть в админке</a>')
        message = "\n".join(body_lines)
        message_id, send_error = self.send_to_topic(platform_settings, topic_key, message)
        if message_id is None:
            logger.warning(
                "Ops Telegram failed to deliver %s to topic %s: %s",
                event_code,
                topic_key,
                send_error or "unknown error",
            )

    async def send_test_message(
        self,
        *,
        topic_key: str,
        initiated_by_email: str,
        chat_id_override: str | None = None,
        thread_id_override: int | None = None,
    ) -> dict[str, Any]:
        billing = BillingPolicyService(self.db)
        platform_settings = await billing.get_platform_settings()
        settings_dirty = False
        if chat_id_override is not None:
            normalized_chat_id = chat_id_override.strip()
            platform_settings.ops_telegram_chat_id = normalized_chat_id or None
            if normalized_chat_id:
                platform_settings.ops_telegram_enabled = True
            settings_dirty = True
        if thread_id_override is not None and topic_key in OPS_TOPIC_BY_KEY:
            topics = self.parse_topics(platform_settings)
            topic_state = topics.get(topic_key, {})
            topics[topic_key] = {
                "thread_id": int(thread_id_override),
                "enabled": bool(topic_state.get("enabled", True)),
            }
            platform_settings.ops_telegram_topics_json = json.dumps(
                topics,
                ensure_ascii=False,
            )
            settings_dirty = True
        if settings_dirty:
            await self.db.flush()
            await self.db.commit()
            await self.db.refresh(platform_settings)

        delivery_error = self._delivery_error(platform_settings, require_enabled=False)
        if delivery_error:
            raise ValueError(delivery_error)
        if topic_key not in OPS_TOPIC_BY_KEY:
            raise ValueError(f"Неизвестный топик: {topic_key}")

        definition = OPS_TOPIC_BY_KEY[topic_key]
        thread_id = self._resolve_thread_id(
            platform_settings,
            topic_key,
            thread_id_override=thread_id_override,
        )
        if thread_id is None:
            raise ValueError(
                f"Для топика «{definition.title}» не задан thread_id. "
                "Создайте топики через бота или укажите thread_id вручную."
            )

        text = (
            f"<b>Тест · {self._escape_html(definition.title)}</b>\n"
            f"Инициатор: {self._escape_html(initiated_by_email)}\n"
            f"UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
        )
        message_id, send_error = self.send_to_topic(
            platform_settings,
            topic_key,
            text,
            require_enabled=False,
            chat_id_override=chat_id_override,
            thread_id_override=thread_id_override,
        )
        if message_id is None:
            hint = send_error or "Проверьте chat_id, thread_id и права бота в форум-чате."
            raise ValueError(f"Не удалось отправить тест: {hint}")
        return {
            "ok": True,
            "topic_key": topic_key,
            "chat_id": platform_settings.ops_telegram_chat_id,
            "thread_id": thread_id,
            "telegram_message_id": message_id,
        }

    async def provision_forum_topics(
        self,
        *,
        initiated_by_email: str,
        chat_id_override: str | None = None,
    ) -> dict[str, Any]:
        billing = BillingPolicyService(self.db)
        platform_settings = await billing.get_platform_settings()
        if chat_id_override is not None:
            normalized_override = chat_id_override.strip()
            platform_settings.ops_telegram_chat_id = normalized_override or None
            if normalized_override:
                platform_settings.ops_telegram_enabled = True
        chat_id = (platform_settings.ops_telegram_chat_id or "").strip()
        if not chat_id:
            raise ValueError(
                "Укажите chat_id служебного форум-чата и сохраните настройки "
                "(кнопка «Сохранить служебный чат»)."
            )
        bot_token = self._notifications._get_telegram_bot_token(platform_settings)  # noqa: SLF001
        if not bot_token:
            raise ValueError("Токен Telegram-бота не настроен.")

        try:
            base_url = self._notifications._normalize_telegram_api_base_url(  # noqa: SLF001
                platform_settings.telegram_api_base_url
            )
        except ValueError as exc:
            raise ValueError("Некорректный Telegram API URL.") from exc

        topics = self.parse_topics(platform_settings)
        created: dict[str, int] = {}
        for definition in OPS_TOPIC_DEFINITIONS:
            if topics.get(definition.key, {}).get("thread_id") is not None:
                continue
            url = f"{base_url}/bot{bot_token}/createForumTopic"
            response = requests.post(
                url,
                json={
                    "chat_id": chat_id,
                    "name": definition.title[:128],
                },
                timeout=12,
            )
            if response.status_code >= 400:
                raise ValueError(
                    f"createForumTopic ({definition.key}): HTTP {response.status_code} — "
                    f"{response.text[:200]}"
                )
            body = response.json()
            if not isinstance(body, dict) or body.get("ok") is not True:
                raise ValueError(
                    f"createForumTopic ({definition.key}): {json.dumps(body, ensure_ascii=False)[:200]}"
                )
            result = body.get("result") or {}
            thread_id = result.get("message_thread_id")
            if thread_id is None:
                raise ValueError(f"createForumTopic ({definition.key}): нет message_thread_id в ответе.")
            created[definition.key] = int(thread_id)
            topics[definition.key] = {"thread_id": int(thread_id), "enabled": True}

        if created:
            platform_settings.ops_telegram_topics_json = json.dumps(topics, ensure_ascii=False)
            platform_settings.ops_telegram_enabled = True

        if chat_id_override is not None or created:
            await self.db.flush()
            await self.db.commit()

        intro = (
            f"<b>Служебный чат платформы</b>\n"
            f"Топики созданы: {self._escape_html(initiated_by_email)}\n"
            f"UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
        )
        self.send_to_topic(platform_settings, "reports", intro)

        return {
            "ok": True,
            "chat_id": chat_id,
            "created_topics": created,
            "topics": topics,
        }

    async def build_and_send_daily_report(self) -> bool:
        billing = BillingPolicyService(self.db)
        platform_settings = await billing.get_platform_settings()
        if not self._is_configured(platform_settings):
            return False
        if "daily_report" not in self.parse_enabled_events(platform_settings):
            return False

        now = datetime.now(timezone.utc)
        since = now - timedelta(hours=24)

        pending_apps = await self.db.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.status == "pending_review")
        )
        pending_payouts = await self.db.scalar(
            select(func.count())
            .select_from(PayoutRequest)
            .where(PayoutRequest.status == "pending_review")
        )
        paid_count = await self.db.scalar(
            select(func.count())
            .select_from(Invoice)
            .where(
                Invoice.status.in_(("paid", "confirmed")),
                Invoice.updated_at >= since,
            )
        )
        expired_count = await self.db.scalar(
            select(func.count())
            .select_from(Invoice)
            .where(
                Invoice.status == "cancelled",
                Invoice.updated_at >= since,
            )
        )
        confirmed_volume = await self.db.scalar(
            select(func.coalesce(func.sum(Invoice.amount_fiat), 0)).where(
                Invoice.status == "confirmed",
                Invoice.confirmed_at >= since,
            )
        )

        volume_text = self._format_decimal(confirmed_volume or Decimal("0"))
        lines = [
            f"Период: последние 24ч (до {now.strftime('%Y-%m-%d %H:%M')} UTC)",
            f"Заявок на модерации: {pending_apps or 0}",
            f"Выплат на проверке: {pending_payouts or 0}",
            f"Оплачено инвойсов: {paid_count or 0}",
            f"Истекло (cancelled): {expired_count or 0}",
            f"Подтверждённый оборот (fiat): {volume_text}",
        ]
        await self.notify_event(
            event_code="daily_report",
            title="📊 Ежедневный дайджест платформы",
            lines=lines,
        )
        return True

    @staticmethod
    def _resolve_admin_link(
        platform_settings: PlatformSetting,
        admin_url: str | None,
    ) -> str | None:
        if not admin_url:
            return None
        if admin_url.startswith("http://") or admin_url.startswith("https://"):
            return admin_url
        base = settings.resolve_admin_console_base_url()
        if not base:
            base = (platform_settings.notification_primary_url or "").strip().rstrip("/")
        if not base:
            return None
        path = admin_url if admin_url.startswith("/") else f"/{admin_url}"
        return f"{base.rstrip('/')}{path}"

    @staticmethod
    def _escape_html(value: str) -> str:
        return (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    @staticmethod
    def _format_decimal(value: Decimal) -> str:
        normalized = value.quantize(Decimal("0.01"))
        return f"{normalized:f}"
