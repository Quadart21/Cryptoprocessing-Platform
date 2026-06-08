# Webhooks

Подпись HMAC, формат payload и тестовая доставка.

## Настроить webhook

Требуется JWT и право `client.webhooks.write`.

```bash
curl -X POST "https://api.noren.digital/api/v1/client/webhooks" \
  -H "Authorization: Bearer <jwt_access>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>",
    "webhook_url": "https://merchant.example.com/webhooks/noren",
    "webhook_secret": "merchant-webhook-secret",
    "checkout_delivery": "payment_page"
  }'
```

## Тестовая доставка

```bash
curl -X POST "https://api.noren.digital/api/v1/client/webhooks/test" \
  -H "Authorization: Bearer <jwt_access>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>"
  }'
```

Используйте после сохранения webhook URL и secret.

## Формат payload

```json
{
  "event": "invoice.confirmed",
  "event_id": "evt_01J_DOCS_EXAMPLE",
  "sent_at": "2026-03-30T12:45:00Z",
  "invoice": {
    "id": "inv_01J_DOCS_EXAMPLE",
    "merchant_order_id": "order_102394",
    "provider_order_id": "cc_992211",
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
    "provider_fee": "0.20",
    "platform_fee": "0.80",
    "turnover_fee": "0.10",
    "net_amount": "98.90",
    "currency": "USDT"
  }
}
```

## Заголовки доставки

| Заголовок | Описание |
| --- | --- |
| `Content-Type` | `application/json` |
| `User-Agent` | `Merset-Webhook/1.0` |
| `X-Merset-Event` | Имя события (например `invoice.confirmed`) |
| `X-Merset-Event-Id` | Уникальный id доставки |
| `X-Merset-Timestamp` | ISO-8601 timestamp |
| `X-Merset-Signature` | `sha256=<hex>` — см. ниже |

## Проверка подписи

Тело запроса сериализуется в JSON **без лишних пробелов**:

```python
body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
```

Подпись:

```
X-Merset-Signature: sha256=<hex>
```

где `<hex>` = HMAC-SHA256(`webhook_secret`, `body` в UTF-8).

{% hint style="danger" %}
* Сохраняйте **`event_id`**, чтобы исключить повторную обработку.
* Поля `payment_page_url` / `payment_address` / `qr_url` зависят от `checkout_delivery` проекта.
* Отвечайте **2xx** только после успешной записи события во внутреннюю систему.
{% endhint %}
