# WordPress + WooCommerce

Плагин **Noren Digital Payments** добавляет способ оплаты в WooCommerce.

## Требования

- WordPress 6.0+, WooCommerce 7.0+, PHP 8.0+ (cURL)
- API-ключи и project_id из кабинета мерчанта

## Установка

1. Скопируйте `integrations/wordpress/noren-payments` в `wp-content/plugins/noren-payments`.
2. Активируйте плагин.
3. **WooCommerce → Настройки → Платежи → Noren Digital (крипто)**.

## Webhook

URL для кабинета мерчанта (появится в настройках плагина):

`https://ваш-магазин.ru/wp-json/noren/v1/webhook`

Укажите тот же **webhook secret**, что и в кабинете.

## Поток оплаты

1. Checkout → способ «Оплата криптовалютой».
2. `POST /invoices`, `merchant_order_id = wc-{id}`.
3. Редирект на `payment_page_url`.
4. Webhook меняет статус заказа на «Оплачен».
