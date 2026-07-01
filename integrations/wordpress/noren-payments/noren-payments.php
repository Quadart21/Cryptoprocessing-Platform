<?php
/**
 * Plugin Name: Noren Digital Payments
 * Plugin URI: https://github.com/Quadart21/Cryptoprocessing-Platform
 * Description: Приём криптоплатежей через Noren Digital / CryptoProcessing для WooCommerce.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Author: Noren Digital
 * Text Domain: noren-payments
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('NOREN_PAYMENTS_VERSION', '1.0.0');
define('NOREN_PAYMENTS_PATH', plugin_dir_path(__FILE__));
define('NOREN_PAYMENTS_URL', plugin_dir_url(__FILE__));

require_once NOREN_PAYMENTS_PATH . 'vendor/noren/NorenApiClient.php';
require_once NOREN_PAYMENTS_PATH . 'vendor/noren/NorenWebhookVerifier.php';
require_once NOREN_PAYMENTS_PATH . 'includes/class-noren-api.php';
require_once NOREN_PAYMENTS_PATH . 'includes/class-noren-webhook.php';

add_action('plugins_loaded', static function (): void {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>Noren Digital Payments требует WooCommerce.</p></div>';
        });
        return;
    }

    require_once NOREN_PAYMENTS_PATH . 'includes/class-wc-gateway-noren.php';
    add_filter('woocommerce_payment_gateways', static function (array $gateways): array {
        $gateways[] = 'WC_Gateway_Noren';
        return $gateways;
    });
});

add_action('rest_api_init', static function (): void {
    Noren_Webhook::register_routes();
});

register_activation_hook(__FILE__, static function (): void {
    if (!get_option('noren_payments_db_version')) {
        add_option('noren_payments_db_version', NOREN_PAYMENTS_VERSION);
    }
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, static function (): void {
    flush_rewrite_rules();
});
