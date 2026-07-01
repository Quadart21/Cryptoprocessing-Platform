<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

class WC_Gateway_Noren extends WC_Payment_Gateway
{
    public function __construct()
    {
        $this->id = 'noren';
        $this->icon = '';
        $this->has_fields = false;
        $this->method_title = 'Noren Digital (крипто)';
        $this->method_description = 'Оплата криптовалютой через Noren Digital / CryptoProcessing.';
        $this->supports = ['products'];

        $this->init_form_fields();
        $this->init_settings();

        $this->title = (string) $this->get_option('title', 'Оплата криптовалютой');
        $this->description = (string) $this->get_option('description', 'Вы будете перенаправлены на защищённую страницу оплаты.');
        $this->enabled = (string) $this->get_option('enabled', 'no');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        add_action('woocommerce_thankyou_' . $this->id, [$this, 'thankyou_page']);
    }

    public function init_form_fields(): void
    {
        $this->form_fields = [
            'enabled' => [
                'title' => 'Включить',
                'type' => 'checkbox',
                'label' => 'Принимать платежи через Noren Digital',
                'default' => 'no',
            ],
            'title' => [
                'title' => 'Название',
                'type' => 'text',
                'default' => 'Оплата криптовалютой',
            ],
            'description' => [
                'title' => 'Описание',
                'type' => 'textarea',
                'default' => 'USDT и другие криптовалюты. Безопасная checkout-страница платформы.',
            ],
            'api_base_url' => [
                'title' => 'API Base URL',
                'type' => 'text',
                'description' => 'Например: https://api.noren.digital/api/v1/client',
                'default' => 'https://api.noren.digital/api/v1/client',
            ],
            'project_id' => [
                'title' => 'Project ID',
                'type' => 'text',
                'description' => 'ID проекта из кабинета мерчанта.',
            ],
            'api_public_key' => [
                'title' => 'API Public Key',
                'type' => 'text',
            ],
            'api_secret_key' => [
                'title' => 'API Secret Key',
                'type' => 'password',
                'description' => 'Хранится только на сервере WordPress.',
            ],
            'webhook_secret' => [
                'title' => 'Webhook Secret',
                'type' => 'password',
                'description' => 'Секрет для проверки X-Merset-Signature. Укажите тот же в кабинете мерчанта.',
            ],
            'webhook_url_hint' => [
                'title' => 'Webhook URL',
                'type' => 'title',
                'description' => '<code>' . esc_html(Noren_Webhook::webhookUrl()) . '</code><br>Укажите этот URL в кабинете мерчанта → Интеграция → Webhook.',
            ],
            'crypto_currency' => [
                'title' => 'Криптовалюта по умолчанию',
                'type' => 'text',
                'default' => 'USDT',
            ],
            'network' => [
                'title' => 'Сеть по умолчанию',
                'type' => 'text',
                'default' => 'TRC20',
            ],
        ];
    }

    public function process_payment($order_id): array
    {
        $order = wc_get_order($order_id);
        if (!$order instanceof WC_Order) {
            wc_add_notice('Заказ не найден.', 'error');
            return ['result' => 'fail'];
        }

        try {
            $invoice = Noren_Api::createInvoiceForOrder($order);
        } catch (Throwable $exception) {
            wc_add_notice('Не удалось создать платёж: ' . $exception->getMessage(), 'error');
            return ['result' => 'fail'];
        }

        $paymentUrl = (string) ($invoice['payment_page_url'] ?? '');
        if ($paymentUrl === '') {
            wc_add_notice('API не вернул payment_page_url. Проверьте checkout_delivery проекта.', 'error');
            return ['result' => 'fail'];
        }

        $order->update_meta_data('_noren_invoice_id', (string) ($invoice['id'] ?? ''));
        $order->update_meta_data('_noren_payment_page_url', $paymentUrl);
        $order->update_status('on-hold', 'Ожидание криптооплаты через Noren Digital.');
        $order->save();

        WC()->cart->empty_cart();

        return [
            'result' => 'success',
            'redirect' => $paymentUrl,
        ];
    }

    public function thankyou_page(int $order_id): void
    {
        $order = wc_get_order($order_id);
        if (!$order instanceof WC_Order) {
            return;
        }

        $paymentUrl = (string) $order->get_meta('_noren_payment_page_url');
        if ($paymentUrl !== '' && $order->has_status(['pending', 'on-hold'])) {
            echo '<p><a class="button" href="' . esc_url($paymentUrl) . '">Вернуться к оплате</a></p>';
        }
    }
}
