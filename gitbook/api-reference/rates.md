# Курсы и лимиты

`GET /rates` — чем можно принять оплату сейчас: валюта, сеть, лимиты, доступность. Вызывайте перед созданием счёта и кэшируйте недолго.

```bash
curl -X GET "https://api.noren.digital/api/v1/client/rates" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

```json
{
  "items": [
    {
      "currency": "USDT",
      "networks": [
        {
          "network": "TRC20",
          "min_deposit": "5",
          "max_deposit": "5000",
          "min_deposit_fiat": "5",
          "max_deposit_fiat": "5000",
          "network_fee": "1",
          "client_available": true,
          "memo_required": false,
          "acquiring": true,
          "withdrawal": true
        }
      ]
    }
  ]
}
```

| Поле | Смысл |
| --- | --- |
| `currency` | Код токена. Его передаёте в `crypto_currency`. |
| `network` | Сеть. USDT TRC20 и USDT ERC20 — разные маршруты. |
| `min_deposit` / `max_deposit` | Диапазон в крипте. Вне диапазона — `amount_out_of_range`. |
| `min_deposit_fiat` / `max_deposit_fiat` | Тот же диапазон как ориентир в USD. |
| `client_available` | `true` — пару можно предлагать. `false` — счёт не создавайте. |
| `acquiring` | Приём оплаты по сети включён. |
| `withdrawal` | Сеть можно использовать для вывода. |
| `memo_required` | Без memo перевод не зачислится. Покажите его рядом с адресом. |
| `network_fee` | Ориентир комиссии сети, не тариф 0,4%. |

Как выбрать пару для счёта:

1. Оставьте сети с `client_available` и `acquiring`.
2. Проверьте, что `amount_fiat` внутри фиатных лимитов.
3. В `POST /invoices` передайте `currency` как `crypto_currency` и `network` как `network`.
4. Если `memo_required`, не прячьте `payment_memo` на своём экране.
