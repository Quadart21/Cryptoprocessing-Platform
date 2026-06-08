# FAQ

Ответы на частые вопросы интеграции.

## Где взять public и secret?

Кабинет → **API-ключи**. Secret показывается при создании или перевыпуске — сохраните сразу в backend или секрет-хранилище.

## Куда сохранять ключи?

**Только на backend.** Не используйте secret во frontend, браузере, мобильном приложении или публичном репозитории.

## Payment page или H2H?

`checkout_delivery` в настройках проекта:

| Режим | Что отдаёт API |
| --- | --- |
| `payment_page` | только `payment_page_url` (`/pay/{token}`) |
| `h2h` | `payment_address` и `qr_url` |
| `both` | все поля |

Правило одинаково для `POST /invoices`, `GET /invoices` и webhook.

## Что делать при 4xx и 5xx?

* **4xx** — ошибка в payload, ключах или параметрах. Исправьте запрос.
* **5xx**, **502**, **504** — retry с backoff, логируйте correlation / event id.

## Как считается комиссия?

**0,4%** от суммы успешного платежа, но не менее **$0,70**. Подробнее — [Комиссии](commissions.md).

## Где OpenAPI и Swagger?

* Swagger UI: [https://noren.digital/docs](https://noren.digital/docs)
* OpenAPI JSON: [https://noren.digital/openapi.json](https://noren.digital/openapi.json)

## Как проверить доступность API?

```bash
curl -X GET "https://api.noren.digital/api/v1/client/health"
```

Ответ:

```json
{
  "status": "ok",
  "scope": "client"
}
```
