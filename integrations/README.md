# Модули интеграции для вебмастеров

Готовые заготовки для подключения магазина к **Noren Digital / CryptoProcessing** через [Merchant API](../gitbook/quickstart.md).

## Платформы

| CMS / платформа | Каталог | Сценарий |
| --- | --- | --- |
| **WordPress + WooCommerce** | [wordpress/](wordpress/) | Плагин способа оплаты + REST webhook |
| **DataLife Engine** | [dle/](dle/) | Модуль billing + webhook |
| **Tilda** | [tilda/](tilda/) | PHP-bridge + HTML-форма для Zero Block |
| **1С:Предприятие** | [1c/](1c/) | HTTP-сервис + общий модуль API |

## Общая схема

1. Магазин вызывает `POST /invoices` с `merchant_order_id`.
2. Покупатель платит на `payment_page_url`.
3. Платформа шлёт webhook на URL магазина.
4. Магазин меняет статус заказа при `paid` / `confirmed`.

## Общие требования

- API-ключи (public + secret) — только на сервере.
- `project_id` из кабинета мерчанта.
- Режим checkout **payment_page** для редиректа на hosted checkout.
- Webhook URL + secret в кабинете и на сайте.
- Уникальный `merchant_order_id` с префиксом CMS: `wc-`, `dle-`, `tilda-`, `1c-`.

## Shared-библиотека (PHP)

`shared/php/` — клиент API и проверка `X-Merset-Signature`.

## Документация

- [Быстрый старт](../gitbook/quickstart.md)
- [Checkout](../gitbook/checkout.md)
- [Webhooks](../gitbook/webhooks.md)
