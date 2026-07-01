<?php

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class Noren_Webhook
{
    public static function register_routes(): void
    {
        register_rest_route('noren/v1', '/webhook', [
            'methods' => 'POST',
            'callback' => [self::class, 'handle'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function webhookUrl(): string
    {
        return rest_url('noren/v1/webhook');
    }

    /**
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public static function handle(WP_REST_Request $request)
    {
        $rawBody = $request->get_body();
        $signature = $request->get_header('x-merset-signature');
        $secret = Noren_Api::webhookSecret();

        if ($secret !== '' && !NorenWebhookVerifier::verify($rawBody, $signature, $secret)) {
            return new WP_Error('invalid_signature', 'Invalid webhook signature', ['status' => 401]);
        }

        $payload = NorenWebhookVerifier::parsePayload($rawBody);
        if ($payload === null) {
            return new WP_Error('invalid_payload', 'Invalid JSON payload', ['status' => 400]);
        }

        $eventId = isset($payload['event_id']) ? (string) $payload['event_id'] : '';
        if ($eventId !== '' && self::isDuplicateEvent($eventId)) {
            return new WP_REST_Response(['ok' => true, 'duplicate' => true], 200);
        }

        if (($payload['event'] ?? '') === 'webhook.test') {
            if ($eventId !== '') {
                self::rememberEvent($eventId);
            }
            return new WP_REST_Response(['ok' => true, 'test' => true], 200);
        }

        $invoice = $payload['invoice'] ?? null;
        if (!is_array($invoice)) {
            return new WP_Error('missing_invoice', 'Invoice payload missing', ['status' => 400]);
        }

        $merchantOrderId = (string) ($invoice['merchant_order_id'] ?? '');
        $status = (string) ($invoice['status'] ?? '');

        if (!str_starts_with($merchantOrderId, 'wc-')) {
            return new WP_REST_Response(['ok' => true, 'ignored' => true], 200);
        }

        $orderId = (int) substr($merchantOrderId, 3);
        $order = wc_get_order($orderId);
        if (!$order instanceof WC_Order) {
            return new WP_Error('order_not_found', 'Order not found', ['status' => 404]);
        }

        $order->update_meta_data('_noren_invoice_id', (string) ($invoice['id'] ?? ''));
        $order->update_meta_data('_noren_invoice_status', $status);

        if (NorenWebhookVerifier::isPaidStatus($status)) {
            if (!$order->is_paid()) {
                $order->payment_complete((string) ($invoice['id'] ?? ''));
                $order->add_order_note('Оплата подтверждена через Noren Digital (статус: ' . $status . ').');
            }
        } elseif (NorenWebhookVerifier::isFailedStatus($status)) {
            if ($order->has_status(['pending', 'on-hold'])) {
                $order->update_status('failed', 'Платёж не завершён (статус: ' . $status . ').');
            }
        } else {
            $order->add_order_note('Обновление статуса Noren: ' . $status);
        }

        $order->save();

        if ($eventId !== '') {
            self::rememberEvent($eventId);
        }

        return new WP_REST_Response(['ok' => true], 200);
    }

    private static function isDuplicateEvent(string $eventId): bool
    {
        return (bool) get_transient('noren_wh_' . md5($eventId));
    }

    private static function rememberEvent(string $eventId): void
    {
        set_transient('noren_wh_' . md5($eventId), 1, WEEK_IN_SECONDS);
    }
}
