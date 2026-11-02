# SDK Python и Node.js

Клиент Merchant API для своего backend: счёт, статус, синхронизация, приём недоплаты, курсы, баланс, транзакции и проверка `X-Merset-Signature`.

Сторонних зависимостей нет. Каталоги можно скопировать в отдельные репозитории — в каждом свой `README` и лицензия MIT.

| Язык | Каталог в репозитории | Пакет |
| --- | --- | --- |
| Python 3.9+ | `sdks/python` | `noren-merchant` |
| Node.js 18+ | `sdks/node` | `noren-merchant` |

На PyPI и npm пакеты пока не опубликованы.

```bash
pip install ./sdks/python
npm install ./sdks/node
```

Base URL по умолчанию: `https://api.noren.digital/api/v1/client`. Можно передать только хост — клиент допишет префикс.

## Python

```python
from noren import NorenClient, is_settled_status

client = NorenClient(
    public_key="<public_key>",
    secret_key="<secret_key>",
    project_id="<project_id>",
)

invoice = client.create_invoice(
    merchant_order_id="order-1001",
    amount_fiat="100.00",
)
# payment_page_url или payment_address — зависит от checkout_delivery
```

Переменные окружения: `NOREN_PUBLIC_KEY`, `NOREN_SECRET_KEY`, `NOREN_PROJECT_ID`, `NOREN_API_BASE` — `NorenClient.from_env()`.

Сумму передавайте строкой, `int` или `Decimal`. `float` клиент не принимает.

## Node.js

```js
import { NorenClient } from "noren-merchant";

const client = new NorenClient({
  publicKey: process.env.NOREN_PUBLIC_KEY,
  secretKey: process.env.NOREN_SECRET_KEY,
  projectId: process.env.NOREN_PROJECT_ID,
});

const invoice = await client.createInvoice({
  merchantOrderId: "order-1001",
  amountFiat: "100.00",
});
```

Пакет — ESM. В CommonJS: `const { NorenClient } = await import("noren-merchant")`.

Для webhook в Express читайте сырое тело: `express.raw({ type: "application/json" })` на этом маршруте, до `express.json()`.

## Webhook

Подпись считается от сырых байт тела. Повторный `JSON.stringify` проверку ломает.

```python
event = client.parse_webhook(
    raw_body,
    signature_header,
    tolerance_seconds=300,
    webhook_secret="<webhook_secret>",
)
```

`is_settled_status` / `isSettledStatus` истинно для `paid`, `confirmed`, `overpaid`. Статус `underpaid` сам по себе заказ не закрывает: покупатель доплачивает, либо магазин вызывает `accept_received` / `acceptReceived`. После зачисления в payload `amount_review.credited = true`.

`event_id` сохраняйте и не обрабатывайте дважды. `2xx` отвечайте после записи события у себя.

## Методы

* `create_invoice` / `createInvoice`
* `get_invoice` / `getInvoice` — `sync=true` обновляет статус у провайдера
* `list_invoices` / `listInvoices`
* `sync_invoice` / `syncInvoice`
* `accept_received` / `acceptReceived` — зачесть недоплату по факту
* `get_rates` / `getRates`
* `get_balance` / `getBalance`
* `list_transactions` / `listTransactions`, `get_transaction` / `getTransaction`

Вход в кабинет по JWT и настройка webhook URL в SDK не входят: это делается в кабинете.

PHP-клиент для CMS-модулей — `integrations/shared/php/`.
