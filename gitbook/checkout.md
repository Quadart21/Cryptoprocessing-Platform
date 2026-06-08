# Checkout: payment page / H2H

Как отдавать клиенту ссылку `/pay/{token}` или адрес/QR — зависит от `checkout_delivery` проекта.

## Режим checkout\_delivery

Для каждого проекта администратор платформы задаёт **`checkout_delivery`**. Мерчант видит текущий режим в разделе «Интеграция → Webhook», но изменить его самостоятельно не может.

Поле влияет на:

* ответ `POST /invoices`
* ответ `GET /invoices` и `GET /invoices/{id}`
* payload входящих webhook

## payment\_page — hosted checkout

* В ответе API — только **`payment_page_url`** (поля `payment_address` и `qr_url` отсутствуют).
* Клиент переходит на страницу вида `/pay/{token}` — QR, адрес, таймер и статус.
* Webhook дублирует тот же набор полей в объекте `invoice`.

```json
{
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page"
}
```

## h2h — head-to-head интеграция

* В ответе — **`payment_address`** и **`qr_url`**; `payment_page_url` отсутствует.
* Подходит, если вы сами рисуете экран оплаты в своём приложении.

```json
{
  "payment_address": "TG9...example",
  "qr_url": "https://example.com/qr/inv_01J",
  "checkout_delivery": "h2h"
}
```

## both — обратная совместимость

Режим **`both`** возвращает все поля.

## Публичный API checkout (без ключей)

Для кастомной checkout-страницы можно опрашивать:

* `GET https://noren.digital/api/v1/public/pay/{token}`
* `POST .../refresh` — синхронизация статуса

{% hint style="info" %}
Перед созданием инвойса вызывайте `GET /rates`: `min_deposit` — в криптовалюте, `min_deposit_fiat` — ориентир в USD.
{% endhint %}
