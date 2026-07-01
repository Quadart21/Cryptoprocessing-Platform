<?php
/**
 * Webhook endpoint для DLE + Noren Digital.
 *
 * URL: https://site.ru/engine/modules/billing/payment/noren_webhook.php
 */

declare(strict_types=1);

define('DATALIFEENGINE', true);
define('ROOT_DIR', dirname(__DIR__, 4));
define('ENGINE_DIR', ROOT_DIR . '/engine');

require_once ENGINE_DIR . '/data/config.php';
require_once ENGINE_DIR . '/classes/mysql.php';
require_once ENGINE_DIR . '/data/dbconfig.php';
require_once __DIR__ . '/vendor/noren/NorenWebhookVerifier.php';

$db = new db();

$row = $db->super_query("SELECT settings FROM " . PREFIX . "_billing WHERE name='noren' LIMIT 1");
$settings = [];
if (!empty($row['settings'])) {
    $settings = unserialize($row['settings'], ['allowed_classes' => false]);
    if (!is_array($settings)) {
        $settings = [];
    }
}

$secret = (string) ($settings['webhook_secret'] ?? '');
$rawBody = file_get_contents('php://input') ?: '';
$signature = $_SERVER['HTTP_X_MERSET_SIGNATURE'] ?? null;

if ($secret !== '' && !NorenWebhookVerifier::verify($rawBody, is_string($signature) ? $signature : null, $secret)) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'invalid_signature']);
    exit;
}

$payload = NorenWebhookVerifier::parsePayload($rawBody);
if ($payload === null) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'invalid_payload']);
    exit;
}

if (($payload['event'] ?? '') === 'webhook.test') {
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'test' => true]);
    exit;
}

$invoice = $payload['invoice'] ?? null;
if (!is_array($invoice)) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_invoice']);
    exit;
}

$merchantOrderId = (string) ($invoice['merchant_order_id'] ?? '');
$status = (string) ($invoice['status'] ?? '');

if (!str_starts_with($merchantOrderId, 'dle-')) {
    http_response_code(200);
    echo json_encode(['ok' => true, 'ignored' => true]);
    exit;
}

$billingInvoiceId = (int) substr($merchantOrderId, 4);
if ($billingInvoiceId <= 0) {
    http_response_code(404);
    echo json_encode(['error' => 'invalid_order']);
    exit;
}

if (NorenWebhookVerifier::isPaidStatus($status)) {
    $db->query("UPDATE " . PREFIX . "_billing_invoice SET status='1', date_pay=NOW() WHERE id='{$billingInvoiceId}' AND status='0'");
}

http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['ok' => true]);
