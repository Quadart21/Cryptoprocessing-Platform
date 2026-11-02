# noren-merchant (Python)

Клиент [Merchant API](https://api.noren.digital/api/v1/client) Noren Digital: счёт, статус, баланс, курсы и проверка входящего webhook.

Зависимостей нет. Нужен Python 3.9+.

Пакет лежит в каталоге `sdks/python` этого репозитория. На PyPI его ещё нет — поставьте из каталога или скопируйте каталог в отдельный репозиторий и опубликуйте сами.

```bash
pip install ./sdks/python
```

После публикации на PyPI:

```bash
pip install noren-merchant
```

## Счёт

Ключи только на сервере. `NOREN_API_BASE` можно указать как хост — клиент сам допишет `/api/v1/client`.

```python
from noren import NorenClient

client = NorenClient(
    public_key="pk_...",
    secret_key="sk_...",
    project_id="prj_...",
    # base_url="https://api.noren.digital",
)

invoice = client.create_invoice(
    merchant_order_id="order-1001",
    amount_fiat="100.00",  # str, int или Decimal. float не принимается
    fiat_currency="USD",
    crypto_currency="USDT",
    network="TRC20",
)

# payment_page — отдайте покупателю ссылку
print(invoice["payment_page_url"])
# h2h — адрес и QR в ответе, страницы нет
print(invoice.get("payment_address"))
```

То же из переменных окружения `NOREN_PUBLIC_KEY`, `NOREN_SECRET_KEY`, `NOREN_PROJECT_ID`, `NOREN_API_BASE`:

```python
client = NorenClient.from_env()
```

Дальше:

```python
client.get_invoice(invoice["id"])
client.get_invoice(invoice["id"], sync=True)
client.sync_invoice(invoice["id"])
client.list_invoices(limit=20)
client.get_rates()
client.get_balance()
client.list_transactions()
```

Недоплата не закрывает заказ. Покупатель доплачивает на тот же адрес, либо магазин принимает пришедшую сумму:

```python
client.accept_received(invoice["id"])
```

Ошибки API — `NorenError`: `status_code`, `code`, `detail`. Например `amount_out_of_range`.

## Webhook

Платформа шлёт `X-Merset-Signature: sha256=<hex>` — HMAC-SHA256 сырого тела и `webhook_secret`. Тело нужно брать как пришло, без повторного `json.dumps`.

```python
from flask import Flask, request

from noren import NorenSignatureError, is_settled_status

app = Flask(__name__)
WEBHOOK_SECRET = "..."  # тот же секрет, что в кабинете


@app.post("/webhooks/noren")
def noren_webhook():
    raw = request.get_data()
    try:
        event = client.parse_webhook(
            raw,
            request.headers.get("X-Merset-Signature"),
            headers=request.headers,
            tolerance_seconds=300,
            webhook_secret=WEBHOOK_SECRET,
        )
    except NorenSignatureError:
        return "invalid signature", 400

    invoice = event["invoice"]
    # event_id сохраните, чтобы не провести одну доставку дважды
    if is_settled_status(invoice.get("status"), invoice.get("amount_review")):
        mark_order_paid(invoice["merchant_order_id"])
    return "", 200
```

`tolerance_seconds` сверяет `X-Merset-Timestamp`. Без него проверяется только подпись.

Статусы:

| Функция | Когда истинно |
| --- | --- |
| `is_paid_status` | `paid`, `confirmed`, `overpaid` |
| `is_underpaid_status` | `underpaid` — счёт ещё открыт |
| `is_failed_status` | `expired`, `cancelled`, `canceled`, `failed` |
| `is_settled_status` | можно выдавать заказ. Недоплата — только если `amount_review.credited` уже `true` |

Отвечайте `2xx` после того, как записали событие у себя.

## Что сознательно не входит

Вход в кабинет по JWT, настройка webhook URL и выплаты. Это операции кабинета, не серверный приём оплаты. См. [документацию Merchant API](../../gitbook/quickstart.md).

## Проверка

```bash
python -m unittest discover -s sdks/python/tests
```

## Отдельный репозиторий

Каталог самодостаточен: `pyproject.toml`, `src/noren`, `README.md`, `LICENSE`. Скопируйте его и опубликуйте как `noren-merchant`.
