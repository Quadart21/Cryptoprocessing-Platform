<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Noren_Api
{
    public static function client(): NorenApiClient
    {
        $settings = get_option('woocommerce_noren_settings', []);
        $base = rtrim((string) ($settings['api_base_url'] ?? ''), '/');
        $public = (string) ($settings['api_public_key'] ?? '');
        $secret = (string) ($settings['api_secret_key'] ?? '');

        if ($base === '' || $public === '' || $secret === '') {
            throw new RuntimeException('Noren API credentials are not configured.');
        }

        return new NorenApiClient($base, $public, $secret);
    }

    public static function projectId(): string
    {
        $settings = get_option('woocommerce_noren_settings', []);
        return (string) ($settings['project_id'] ?? '');
    }

    public static function webhookSecret(): string
    {
        $settings = get_option('woocommerce_noren_settings', []);
        return (string) ($settings['webhook_secret'] ?? '');
    }

    /**
     * @return array<string, mixed>
     */
    public static function createInvoiceForOrder(WC_Order $order): array
    {
        $settings = get_option('woocommerce_noren_settings', []);
        $projectId = (string) ($settings['project_id'] ?? '');
        if ($projectId === '') {
            throw new RuntimeException('Project ID is not configured.');
        }

        $currency = $order->get_currency();
        if ($currency === '') {
            $currency = 'USD';
        }

        $payload = [
            'project_id' => $projectId,
            'merchant_order_id' => 'wc-' . $order->get_id(),
            'amount_fiat' => (string) $order->get_total(),
            'fiat_currency' => $currency,
            'crypto_currency' => (string) ($settings['crypto_currency'] ?? 'USDT'),
            'network' => (string) ($settings['network'] ?? 'TRC20'),
            'metadata' => [
                'source' => 'wordpress-woocommerce',
                'order_id' => $order->get_id(),
                'customer_email' => $order->get_billing_email(),
            ],
        ];

        return self::client()->createInvoice($payload);
    }
}
