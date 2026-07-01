<?php
/**
 * Пример конфигурации Tilda-bridge.
 * Скопируйте в config.php и заполните значения.
 */

return [
    'api_base_url' => 'https://api.noren.digital/api/v1/client',
    'project_id' => '',
    'api_public_key' => '',
    'api_secret_key' => '',
    'webhook_secret' => '',
    'crypto_currency' => 'USDT',
    'network' => 'TRC20',
    'fiat_currency' => 'USD',
    // Секрет для форм Tilda (query ?key= или поле form hidden)
    'form_secret' => 'change-me-to-random-string',
    // Каталог для хранения заказов (webhook обновляет статус)
    'orders_dir' => __DIR__ . '/data/orders',
];
