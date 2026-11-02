# Транзакции

История проводок: сколько пришло, какая комиссия, сколько зачислено. Счета без оплаты сюда не попадают.

Авторизация: `X-API-Key` и `X-API-Secret`.

## Список

```bash
curl -X GET "https://api.noren.digital/api/v1/client/transactions?limit=20&offset=0" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

`limit` — по умолчанию 50, максимум 200. `offset` — смещение следующей страницы.

## Одна операция

`GET /transactions/{transaction_id}`. Id берите из webhook (`transaction.id`) или из списка. Чужой id даст 404.

```json
{
  "id": "tx_01J_DOCS_EXAMPLE",
  "invoice_id": "inv_01J_DOCS_EXAMPLE",
  "gross_amount": "100.00",
  "total_fee": "1.10",
  "net_amount": "98.90",
  "currency": "USDT",
  "status": "confirmed",
  "invoice_status": "confirmed",
  "paid_at": "2026-04-06T11:40:00Z"
}
```

Для сверки хватает трёх полей:

* `gross_amount` — сумма до удержания.
* `total_fee` — комиссия платформы (процент, но не ниже минимума).
* `net_amount` — gross минус fee, то, что относится к балансу.

Комиссия сети блокчейна в эти поля не входит. Она зависит от сети и показывается отдельно в кабинете. Тариф — в разделе [комиссии](../commissions.md).
