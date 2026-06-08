# NorenDigital · Merchant API

Документация по приёму криптовалютных платежей через платформу **NorenDigital**.

Разделы разложены по задачам: старт, checkout, webhooks, справочник методов и тариф.

## Путь интеграции

1. **Ключи** — public + secret на backend
2. **Rates** — выбор сети и лимитов
3. **Invoice** — `POST /invoices`
4. **Webhook** — подтверждение оплаты

## Окружение

| Параметр | Значение |
| --- | --- |
| Merchant API (Base URL) | `https://api.noren.digital/api/v1/client` |
| OpenAPI / Swagger | [https://noren.digital/docs](https://noren.digital/docs) |
| Схема JSON | [https://noren.digital/openapi.json](https://noren.digital/openapi.json) |
| Кабинет мерчанта | [https://app.noren.digital](https://app.noren.digital) |

{% hint style="info" %}
Префикс `/api/v1/client` уже включён в Base URL — в примерах curl используйте пути вида `/invoices`, `/rates`.
{% endhint %}

## Куда перейти

* [Быстрый старт](quickstart.md) — ключи → rates → инвойс → webhook
* [Checkout](checkout.md) — hosted `/pay/{token}` или H2H-реквизиты
* [API методы](api-reference/summary.md) — таблица endpoint'ов и примеры
* [Webhooks](webhooks.md) — HMAC, `event_id`, тест доставки
* [Комиссии](commissions.md) — 0,4%, минимум $0,70
* [FAQ](faq.md) — ключи, ошибки, sandbox
