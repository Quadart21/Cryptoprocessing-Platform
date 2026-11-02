# Webhook

Платформа вызывает ваш URL, когда у счёта меняется статус. Это основной способ закрыть заказ.

## События

| `event` | Когда |
| --- | --- |
| `invoice.status_changed` | Боевое изменение: перевод найден, подтверждён, недоплата, отмена. |
| `invoice.test_deposit` | Тест из кабинета или `POST /webhooks/test`. Статус счёта не меняется, в теле есть `simulated: true`. |

Имя дублируется заголовком `X-Merset-Event`. Тело обрабатывайте только после проверки подписи.

## Куда слать

URL и секрет задаются на проект. Нужен JWT и право `client.webhooks.write`, не пара ключей оплаты.

```bash
curl -X POST "https://api.noren.digital/api/v1/client/webhooks" \
  -H "Authorization: Bearer <jwt_access>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>",
    "webhook_url": "https://merchant.example.com/webhooks/noren",
    "webhook_secret": "merchant-webhook-secret"
  }'
```

`webhook_url` — HTTPS, доступный снаружи. `webhook_secret` — ваша строка для HMAC. Тот же секрет, что в CMS-модуле.

Проверка доставки:

```bash
curl -X POST "https://api.noren.digital/api/v1/client/webhooks/test" \
  -H "Authorization: Bearer <jwt_access>" \
  -H "Content-Type: application/json" \
  -d '{ "project_id": "<project_id>" }'
```

## Тело

JSON без лишних пробелов. Поля `invoice` зависят от `checkout_delivery`: лишних реквизитов просто нет.

```json
{
  "event": "invoice.status_changed",
  "event_id": "wh_01J_DOCS_EXAMPLE",
  "sent_at": "2026-03-30T12:45:00+00:00",
  "invoice": {
    "id": "inv_01J_DOCS_EXAMPLE",
    "merchant_order_id": "order_1001",
    "status": "confirmed",
    "amount_fiat": "100.00",
    "fiat_currency": "USD",
    "amount_crypto": "100.25",
    "crypto_currency": "USDT",
    "network": "TRC20",
    "payment_page_url": "https://noren.digital/pay/abc123example",
    "checkout_delivery": "payment_page"
  },
  "transaction": {
    "id": "tx_01J_DOCS_EXAMPLE",
    "status": "confirmed",
    "gross_amount": "100.00",
    "total_fee": "1.10",
    "net_amount": "98.90",
    "currency": "USDT"
  }
}
```

| Поле | Смысл |
| --- | --- |
| `event_id` | Id этой доставки. Повтор с тем же id игнорируйте. |
| `invoice.id` | Счёт. Второй депозит по недоплате приходит с тем же id. |
| `invoice.merchant_order_id` | Ваш номер заказа. |
| `invoice.status` | Закрывайте заказ на `confirmed`. |
| `transaction` | Появляется, когда есть проводка. `net_amount` — после комиссии. Пока оплаты нет, поле `null`. |

## Подпись

Считается от сырого тела, байт в байт. Не разбирайте JSON и не сериализуйте заново.

1. Прочитайте raw body как UTF-8.
2. Возьмите `webhook_secret` проекта.
3. Посчитайте HMAC-SHA256(secret, body) и переведите в hex.
4. Сравните с `X-Merset-Signature`. Ожидается `sha256=<hex>`.
5. Сравнение — константное по времени. Если не сошлось, ответьте 401 и ничего не зачисляйте.
6. Если `event_id` уже обработан — ответьте 2xx и выйдите.

```python
import hmac
import hashlib

def signature_ok(secret: str, raw_body: bytes, header: str) -> bool:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    return hmac.compare_digest(expected, header or "")
```

| Заголовок | Зачем |
| --- | --- |
| `Content-Type` | `application/json` |
| `User-Agent` | `Merset-Webhook/1.0` |
| `X-Merset-Event` | Имя события |
| `X-Merset-Event-Id` | Тот же id, что `event_id` |
| `X-Merset-Timestamp` | Время отправки |
| `X-Merset-Signature` | `sha256=` и hex HMAC |

Отвечайте **2xx** только после записи события. Иначе доставка считается неудачной.

## Повторы

До трёх попыток с короткой паузой. Если все три без 2xx, заберите статус через `GET /invoices/{id}` или `POST /sync`. Повтор может прийти с новым `event_id` и тем же `invoice.id`: не зачисляйте один `merchant_order_id` дважды.
