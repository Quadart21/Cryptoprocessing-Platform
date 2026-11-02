# noren-merchant (Node.js)

Клиент [Merchant API](https://api.noren.digital/api/v1/client) Noren Digital: счёт, статус, баланс, курсы и проверка входящего webhook.

Node.js 18+ (есть `fetch`). Сторонних зависимостей нет. Пакет — ESM (`import`).

Каталог `sdks/node` этого репозитория. На npm его ещё нет — поставьте из каталога или скопируйте каталог в отдельный репозиторий и опубликуйте сами.

```bash
npm install ./sdks/node
```

После публикации:

```bash
npm install noren-merchant
```

## Счёт

Ключи только на сервере. `baseUrl` можно указать как хост — клиент допишет `/api/v1/client`.

```js
import { NorenClient } from "noren-merchant";

const client = new NorenClient({
  publicKey: process.env.NOREN_PUBLIC_KEY,
  secretKey: process.env.NOREN_SECRET_KEY,
  projectId: process.env.NOREN_PROJECT_ID,
  // baseUrl: "https://api.noren.digital",
});

const invoice = await client.createInvoice({
  merchantOrderId: "order-1001",
  amountFiat: "100.00",
  fiatCurrency: "USD",
  cryptoCurrency: "USDT",
  network: "TRC20",
});

// payment_page — отдайте покупателю ссылку
console.log(invoice.payment_page_url);
// h2h — адрес и QR в ответе, страницы нет
console.log(invoice.payment_address);
```

Поля можно писать и в snake_case (`merchant_order_id`, `amount_fiat`) — так же, как в JSON API.

Из окружения (`NOREN_PUBLIC_KEY`, `NOREN_SECRET_KEY`, `NOREN_PROJECT_ID`, `NOREN_API_BASE`):

```js
const client = NorenClient.fromEnv();
```

Дальше: `getInvoice`, `getInvoice(id, { sync: true })`, `syncInvoice`, `listInvoices`, `getRates`, `getBalance`, `listTransactions`.

Недоплата не закрывает заказ. Покупатель доплачивает на тот же адрес, либо магазин принимает пришедшую сумму:

```js
await client.acceptReceived(invoice.id);
```

Ошибки API — `NorenError`: `statusCode`, `code`, `detail`. Например `amount_out_of_range`.

CommonJS:

```js
const { NorenClient } = await import("noren-merchant");
```

## Webhook

Платформа шлёт `X-Merset-Signature: sha256=<hex>` — HMAC-SHA256 сырого тела и `webhook_secret`. Берите тело как пришло. `express.json()` до проверки подписи ломает сверку: повесьте `express.raw({ type: "application/json" })` на этот маршрут.

```js
import express from "express";
import { NorenSignatureError, isSettledStatus } from "noren-merchant";

const app = express();

app.post(
  "/webhooks/noren",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const event = client.parseWebhook(req.body, req.get("X-Merset-Signature"), {
        headers: req.headers,
        toleranceSeconds: 300,
        webhookSecret: process.env.NOREN_WEBHOOK_SECRET,
      });
      const invoice = event.invoice;
      // event_id сохраните, чтобы не провести одну доставку дважды
      if (isSettledStatus(invoice.status, invoice.amount_review)) {
        markOrderPaid(invoice.merchant_order_id);
      }
      res.sendStatus(200);
    } catch (error) {
      if (error instanceof NorenSignatureError) {
        res.status(400).send("invalid signature");
        return;
      }
      throw error;
    }
  },
);
```

`toleranceSeconds` сверяет `X-Merset-Timestamp`. Без него проверяется только подпись.

| Функция | Когда истинно |
| --- | --- |
| `isPaidStatus` | `paid`, `confirmed`, `overpaid` |
| `isUnderpaidStatus` | `underpaid` — счёт ещё открыт |
| `isFailedStatus` | `expired`, `cancelled`, `canceled`, `failed` |
| `isSettledStatus` | можно выдавать заказ. Недоплата — только если `amount_review.credited` уже `true` |

Отвечайте `2xx` после того, как записали событие у себя.

## Что сознательно не входит

Вход в кабинет по JWT, настройка webhook URL и выплаты. Это операции кабинета, не серверный приём оплаты.

## Проверка

```bash
npm test
```

из каталога `sdks/node`.

## Отдельный репозиторий

Каталог самодостаточен: `package.json`, `src/`, `README.md`, `LICENSE`. Скопируйте его и опубликуйте как `noren-merchant`.
