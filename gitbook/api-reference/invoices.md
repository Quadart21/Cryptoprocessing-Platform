# Счета

Заявка на оплату: создать, прочитать, обновить статус, принять недоплату.

Авторизация всех методов ниже: `X-API-Key` и `X-API-Secret`.

Base URL: `https://api.noren.digital/api/v1/client`

## Создать счёт

`POST /invoices` — в момент, когда заказ у вас уже есть.

Перед боевым вызовом сверьтесь с `GET /rates`: `min_deposit` — лимит в крипте, `min_deposit_fiat` — ориентир в USD.

```bash
curl -X POST "https://api.noren.digital/api/v1/client/invoices" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'
```

В ответе `id` — это `invoice_id` для следующих методов. Сразу после создания `status` обычно `pending`. После `expires_at` новый перевод не ждите, если статус так и остался `pending`.

Поля запроса разобраны в [быстром старте](../quickstart.md).

## Список

`GET /invoices?limit=20&offset=0` — счета ключа, новые сверху. Для статуса одного заказа берите метод по id.

| Параметр | Зачем |
| --- | --- |
| `limit` | Размер страницы. По умолчанию 50, максимум 200. |
| `offset` | Смещение. По умолчанию 0. |
| `sync` | `true` обновляет активные счета у провайдера. Дольше и нужно право записи. Для обычного списка оставляйте `false`. |

## Один счёт

`GET /invoices/{invoice_id}` — статус, реквизиты и, когда оплата есть, `settlement` (gross, комиссия, net).

`?sync=true` подтягивает статус провайдера в этом же ответе. Для ручной проверки нормально, в цикле каждую секунду — нет. Основной канал — webhook.

При недоплате:

```json
{
  "status": "underpaid",
  "amount_review": {
    "kind": "underpaid",
    "expected_amount": "250",
    "received_amount": "249.84",
    "remaining_amount": "0.16",
    "credited": false
  }
}
```

`expected_amount` — сколько ждали, `received_amount` — сколько пришло, `remaining_amount` — сколько осталось дослать.

## Синхронизация

`POST /invoices/{invoice_id}/sync` спрашивает провайдера и возвращает тот же объект, что GET одного счёта. Нужен, если webhook потерялся, а счёт ещё `pending`, `confirming` или `underpaid`.

Успешный sync не заменяет webhook: событие всё равно записывайте один раз по `event_id`.

## Принять недоплату

`POST /invoices/{invoice_id}/accept-received` зачисляет уже пришедшую сумму. Вызывайте, только когда клиент на вашем H2H-экране выбрал «оставить эту сумму».

* Счёт должен быть `underpaid`, `amount_review.received_amount` известен.
* После успеха статус становится `confirming` или `confirmed`, `credited` — `true`.
* Если клиент доплачивает — метод не вызывайте. Второй перевод на тот же адрес остаётся на этой заявке, сумма в webhook накопительная.
* На странице `/pay/{token}` то же действие делает сам плательщик, без ваших ключей.

Переплату отдельно подтверждать не нужно: она зачисляется как `paid`.
