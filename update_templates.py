import requests
import json
import sys

API_BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@noren.digital"
ADMIN_PASSWORD = "your_admin_password"

def login():
    resp = requests.post(f"{API_BASE_URL}/auth/login", json={
        "username": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    resp.raise_for_status()
    return resp.json()["access_token"]

def get_current_settings(token):
    resp = requests.get(
        f"{API_BASE_URL}/admin/billing/settings",
        headers={"Authorization": f"Bearer {token}"}
    )
    resp.raise_for_status()
    return resp.json()

def update_templates(token, templates):
    current = get_current_settings(token)
    
    updated = {
        "provider_fee_percent": str(current["provider_fee_percent"]),
        "default_markup_percent": str(current["default_markup_percent"]),
        "default_turnover_fee_percent": str(current["default_turnover_fee_percent"]),
        "allow_tenant_markup_override": current["allow_tenant_markup_override"],
        "allow_tenant_turnover_fee_override": current["allow_tenant_turnover_fee_override"],
        "payouts_enabled": current["payouts_enabled"],
        "email_notifications_enabled": current["email_notifications_enabled"],
        "telegram_notifications_enabled": current["telegram_notifications_enabled"],
        "smtp_bz_enabled": current["smtp_bz_enabled"],
        "smtp_bz_api_base_url": current["smtp_bz_api_base_url"],
        "smtp_bz_sender_email": current["smtp_bz_sender_email"],
        "smtp_bz_sender_name": current["smtp_bz_sender_name"],
        "smtp_bz_reply_to": current["smtp_bz_reply_to"],
        "smtp_bz_tag": current["smtp_bz_tag"],
        "smtp_bz_api_key": current.get("smtp_bz_api_key"),
        "telegram_api_base_url": current["telegram_api_base_url"],
        "telegram_bot_token": current.get("telegram_bot_token"),
        "notification_events": current["notification_events"],
        "notification_brand_name": current["notification_brand_name"],
        "notification_logo_url": current["notification_logo_url"],
        "notification_primary_url": current["notification_primary_url"],
        "notification_templates": templates
    }
    
    resp = requests.put(
        f"{API_BASE_URL}/admin/billing/settings",
        headers={"Authorization": f"Bearer {token}"},
        json=updated
    )
    resp.raise_for_status()
    return resp.json()

TEMPLATES = [
    {
        "code": "api_key_generated",
        "title": "Сгенерирован API-ключ",
        "mode": "confirm",
        "email_subject": "🔑 Ваш API-ключ готов к использованию",
        "email_body": "Добрый день, {{full_name}}!\n\nРады сообщить, что для проекта {{project_name}} успешно создан новый API-ключ.\n\n══════════════════════════════════════\n\n API-Key:\n {{api_key}}\n\n Действителен до: {{api_key_expires_at}}\n\n══════════════════════════════════════\n\n⚠️ Важная рекомендация:\nСохраните ключ в безопасном месте. Мы не храним полную версию ключа, поэтому восстановить его будет невозможно.\n\nПо вопросам технической поддержки: support@noren.digital",
        "telegram_body": "🔑 *API-ключ создан*\n\nПроект: {{project_name}}\n\n`{{api_key}}`\n\nДействителен до: {{api_key_expires_at}}\n\nСохраните ключ — восстановить его будет невозможно."
    },
    {
        "code": "api_key_regenerated",
        "title": "API-ключ перевыпущен",
        "mode": "confirm",
        "email_subject": "🔄 API-ключ перевыпущен",
        "email_body": "Добрый день, {{full_name}}!\n\nДля проекта {{project_name}} был выполнен перевыпуск API-ключа.\n\n══════════════════════════════════════\n\n Новый API-Key:\n {{api_key}}\n\n Действителен до: {{api_key_expires_at}}\n\n══════════════════════════════════════\n\n⚠️ Внимание:\nПредыдущий ключ больше не активен. Все интеграции необходимо обновить с использованием нового ключа.\n\nПо вопросам: support@noren.digital",
        "telegram_body": "🔄 *API-ключ перевыпущен*\n\nПроект: {{project_name}}\n\nНовый ключ:\n`{{api_key}}`\n\nДействителен до: {{api_key_expires_at}}\n\nОбновите интеграции с новым ключом."
    },
    {
        "code": "api_key_revoked",
        "title": "API-ключ отозван",
        "mode": "confirm",
        "email_subject": "⚠️ API-ключ деактивирован",
        "email_body": "Добрый день, {{full_name}}!\n\nСообщаем, что API-ключ для проекта {{project_name}} был деактивирован.\n\nДата отзыва: {{revoked_at}}\n\n══════════════════════════════════════\n\nЕсли вы не инициировали это действие:\n• Немедленно свяжитесь с поддержкой\n• Проверьте безопасность ваших систем\n• Сгенерируйте новый ключ\n\nСлужба поддержки: support@noren.digital",
        "telegram_body": "⚠️ *API-ключ деактивирован*\n\nПроект: {{project_name}}\n\nДата: {{revoked_at}}\n\nЕсли это были не вы — срочно свяжитесь с поддержкой."
    },
    {
        "code": "application_approved",
        "title": "Заявка одобрена",
        "mode": "confirm",
        "email_subject": "✅ Добро пожаловать в Noren.Digital — ваш проект подключён!",
        "email_body": "Добрый день, {{full_name}}!\n\nПоздравляем! Ваша заявка на подключение проекта {{project_name}} успешно одобрена.\n\n══════════════════════════════════════\n\n Теперь вам доступны:\n • Приём криптоплатёжей (BTC, ETH, USDT, USDC)\n • Мгновенные конвертации в фиат\n • Автоматические выплаты\n • Детальная аналитика\n • Персональный менеджер\n\n══════════════════════════════════════\n\nВаши данные для входа:\nEmail: {{email}}\nВременный пароль: {{password}}\n\n══════════════════════════════════════\n\n📌 Рекомендуемые действия:\n1. Войдите в личный кабинет\n2. Смените пароль\n3. Включите двухфакторную аутентификацию\n4. Создайте первый проект\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "✅ *Проект подключён!*\n\nПоздравляем, {{full_name}}!\n\nПроект {{project_name}} успешно активирован в Noren.Digital.\n\nДанные для входа:\nEmail: {{email}}\nПароль: {{password}}\n\nНачните принимать криптоплатёжи уже сегодня!"
    },
    {
        "code": "application_rejected",
        "title": "Заявка отклонена",
        "mode": "notify",
        "email_subject": "Информация о статусе заявки — Noren.Digital",
        "email_body": "Добрый день, {{full_name}}!\n\nБлагодарим за интерес к Noren.Digital. К сожалению, мы не можем одобрить вашу заявку на подключение проекта {{project_name}}.\n\n══════════════════════════════════════\n\n Причина отказа:\n {{rejection_reason}}\n\n══════════════════════════════════════\n\nМы готовы рассмотреть повторную заявку после устранения замечаний. Пожалуйста, свяжитесь с нашей службой поддержки для получения детальной информации.\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "📋 *Статус заявки*\n\nПроект: {{project_name}}\n\nСтатус: отклонено\n\nПричина: {{rejection_reason}}\n\nСвяжитесь с поддержкой для подробностей."
    },
    {
        "code": "application_submitted",
        "title": "Заявка на подключение проекта",
        "mode": "notify",
        "email_subject": "📝 Новая заявка на подключение — Noren.Digital",
        "email_body": "Уважаемый администратор!\n\nПоступила новая заявка на подключение к платформе Noren.Digital.\n\n══════════════════════════════════════\n\n Заявитель:\n • Имя: {{full_name}}\n • Email: {{email}}\n • Проект: {{project_name}}\n • Дата подачи: {{submitted_at}}\n\n══════════════════════════════════════\n\nПожалуйста, проверьте заявку в административной панели и выполните модерацию.",
        "telegram_body": "📝 *Новая заявка*\n\nИмя: {{full_name}}\nEmail: {{email}}\nПроект: {{project_name}}\n\nДата: {{submitted_at}}"
    },
    {
        "code": "password_changed",
        "title": "Пароль изменён",
        "mode": "confirm",
        "email_subject": "🔐 Пароль успешно изменён — Noren.Digital",
        "email_body": "Добрый день, {{full_name}}!\n\nПодтверждаем: пароль вашего аккаунта в системе Noren.Digital успешно изменён.\n\n══════════════════════════════════════\n\n Дата изменения: {{changed_at}}\n\n══════════════════════════════════════\n\n⚠️ Если вы не выполняли это действие:\n• Немедленно свяжитесь с поддержкой\n• Смените пароль повторно\n• Включите двухфакторную аутентификацию\n\nСлужба поддержки: support@noren.digital",
        "telegram_body": "🔐 *Пароль изменён*\n\nДата: {{changed_at}}\n\nЕсли это были не вы — срочно свяжитесь с поддержкой."
    },
    {
        "code": "password_generated",
        "title": "Сгенерирован пароль для входа",
        "mode": "confirm",
        "email_subject": "Добро пожаловать в Noren.Digital — ваши данные для входа",
        "email_body": "Добрый день, {{full_name}}!\n\nДобро пожаловать в Noren.Digital — современную платформу для приёма криптоплатёжей.\n\n══════════════════════════════════════\n\n Ваши данные для входа:\n Email: {{email}}\n Пароль: {{password}}\n\n══════════════════════════════════════\n\n📌 Для безопасности рекомендуем:\n• Сменить пароль при первом входе\n• Включить двухфакторную аутентификацию\n• Ознакомиться с документацией API\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "🔑 *Добро пожаловать!*\n\nДанные для входа в Noren.Digital:\n\nEmail: {{email}}\nПароль: {{password}}\n\nНачните принимать криптоплатёжи!"
    },
    {
        "code": "payout_approved",
        "title": "Запрос на выплату одобрен",
        "mode": "notify",
        "email_subject": "✅ Выплата подтверждена — Noren.Digital",
        "email_body": "Добрый день, {{full_name}}!\n\nОтличные новости! Ваш запрос на выплату успешно одобрен.\n\n══════════════════════════════════════\n\n Детали выплаты:\n Сумма: {{payout_amount}} {{payout_currency}}\n Адрес: {{payout_address}}\n Дата одобрения: {{approved_at}}\n\n══════════════════════════════════════\n\nСредства будут отправлены на указанный адрес в течение 24 часов.\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "✅ *Выплата одобрена*\n\nСумма: {{payout_amount}} {{payout_currency}}\n\nАдрес: `{{payout_address}}`\n\nДата: {{approved_at}}\n\nСредства поступят в течение 24 часов."
    },
    {
        "code": "payout_rejected",
        "title": "Запрос на выплату отклонён",
        "mode": "notify",
        "email_subject": "❌ Выплата отклонена — Noren.Digital",
        "email_body": "Добрый день, {{full_name}}!\n\nСообщаем, что ваш запрос на выплату был отклонён.\n\n══════════════════════════════════════\n\n Детали:\n Сумма: {{payout_amount}} {{payout_currency}}\n Причина: {{rejection_reason}}\n\n══════════════════════════════════════\n\nПо вопросам обращайтесь в службу поддержки.\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "❌ *Выплата отклонена*\n\nСумма: {{payout_amount}} {{payout_currency}}\n\nПричина: {{rejection_reason}}"
    },
    {
        "code": "payout_requested",
        "title": "Запрос на выплату создан",
        "mode": "notify",
        "email_subject": "💰 Запрос на выплату принят — Noren.Digital",
        "email_body": "Добрый день, {{full_name}}!\n\nВаш запрос на выплату успешно создан и направлен на модерацию.\n\n══════════════════════════════════════\n\n Детали запроса:\n Сумма: {{payout_amount}} {{payout_currency}}\n Адрес: {{payout_address}}\n Дата создания: {{requested_at}}\n\n══════════════════════════════════════\n\nВы получите уведомление после одобрения выплаты администратором.\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "💰 *Запрос на выплату*\n\nСумма: {{payout_amount}} {{payout_currency}}\n\nАдрес: `{{payout_address}}`\n\nДата: {{requested_at}}\n\nОжидайте одобрения."
    },
    {
        "code": "two_factor_disabled",
        "title": "2FA отключена",
        "mode": "confirm",
        "email_subject": "🔓 Двухфакторная аутентификация отключена",
        "email_body": "Добрый день, {{full_name}}!\n\nСообщаем, что двухфакторная аутентификация (2FA) была отключена для вашего аккаунта.\n\n══════════════════════════════════════\n\n Дата: {{disabled_at}}\n\n══════════════════════════════════════\n\n⚠️ Внимание:\nДля защиты вашего аккаунта мы настоятельно рекомендуем включить 2FA повторно. Без двухфакторной аутентификации ваш аккаунт менее защищён.\n\nЕсли вы не отключали 2FA — свяжитесь с поддержкой немедленно.\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "🔓 *2FA отключена*\n\nДата: {{disabled_at}}\n\nВключите 2FA повторно для защиты аккаунта.\n\nЕсли это были не вы — срочно свяжитесь с поддержкой."
    },
    {
        "code": "two_factor_enabled",
        "title": "2FA включена",
        "mode": "confirm",
        "email_subject": "🔒 Двухфакторная аутентификация активирована",
        "email_body": "Добрый день, {{full_name}}!\n\nОтличные новости! Двухфакторная аутентификация (2FA) успешно включена для вашего аккаунта.\n\n══════════════════════════════════════\n\n Дата активации: {{enabled_at}}\n\n══════════════════════════════════════\n\n✅ Теперь ваш аккаунт надёжно защищён!\n\nПри каждом входе в систему вам потребуется ввести код из приложения-аутентификатора (Google Authenticator, Authy и др.).\n\nСохраните резервные коды в безопасном месте — они могут понадобиться, если вы потеряете доступ к устройству.\n\nС уважением,\nКоманда Noren.Digital\n\nsupport@noren.digital",
        "telegram_body": "🔒 *2FA включена*\n\nДата: {{enabled_at}}\n\n\nВаш аккаунт теперь защищён двухфакторной аутентификацией!"
    }
]

if __name__ == "__main__":
    try:
        token = login()
        print("Logged in successfully")
        
        result = update_templates(token, TEMPLATES)
        print(f"Templates updated successfully!")
        print(f"Configured templates: {len([t for t in result.get('notification_templates', []) if t.get('email_subject') or t.get('email_body') or t.get('telegram_body')])}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
