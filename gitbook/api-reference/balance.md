# Баланс

`GET /balance` — расчётный баланс мерчанта, обычно в USDT. Это не кошелёк клиента и не один счёт, а то, что уже проведено вам.

```bash
curl -X GET "https://api.noren.digital/api/v1/client/balance" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

```json
{
  "currency": "USDT",
  "available_amount": "980.50",
  "frozen_amount": "0",
  "pending_amount": "20.00",
  "locked_amount": "0",
  "total_amount": "1000.50",
  "hold_hours": 24,
  "next_release_at": "2026-04-07T11:30:00Z",
  "holds": [
    {
      "transaction_id": "tx_01J_DOCS_EXAMPLE",
      "invoice_id": "inv_01J_DOCS_EXAMPLE",
      "merchant_order_id": "order_1001",
      "amount": "98.90",
      "available_at": "2026-04-07T11:30:00Z"
    }
  ]
}
```

| Поле | Смысл |
| --- | --- |
| `available_amount` | Можно использовать. Поле `amount` дублирует его. |
| `pending_amount` | Уже оплачено, но ещё на холде. |
| `frozen_amount` | Заморожено, например на время проверки. |
| `locked_amount` | Заблокировано под незавершённую операцию. |
| `total_amount` | Сумма четырёх частей. Это не «сколько можно вывести». |
| `hold_hours` | Сколько часов оплата держится до `available`. |

`holds` — отдельные оплаты, которые ещё не стали доступными. `amount` там уже net, после комиссии. `available_at` — когда сумма освободится. `next_release_at` — ближайший такой момент.

Вывод на внешний адрес оформляется в кабинете, не этим методом.
