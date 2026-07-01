<?php
/**
 * Tilda bridge — серверный обработчик форм и кнопок оплаты.
 *
 * Tilda не позволяет хранить API secret на фронте, поэтому:
 * 1) Zero Block / форма шлёт POST сюда (amount, order_id, email)
 * 2) Bridge создаёт инвойс и редиректит на payment_page_url
 * 3) Webhook обновляет статус заказа
 */

declare(strict_types=1);

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Создайте config.php из config.example.php';
    exit;
}

/** @var array<string, mixed> $config */
$config = require $configPath;

require_once __DIR__ . '/vendor/noren/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($path) ? rtrim($path, '/') : '';

if ($method === 'POST' && str_ends_with($path, '/webhook')) {
    handleWebhook($config);
    exit;
}

if ($method === 'POST') {
    handleCheckout($config);
    exit;
}

if ($method === 'GET' && isset($_GET['order'])) {
    showOrderStatus($config, (string) $_GET['order']);
    exit;
}

http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'not_found']);

/** @param array<string, mixed> $config */
function handleCheckout(array $config): void
{
    $formSecret = (string) ($config['form_secret'] ?? '');
    $providedSecret = (string) ($_POST['secret'] ?? $_GET['secret'] ?? '');
    if ($formSecret === '' || !hash_equals($formSecret, $providedSecret)) {
        http_response_code(403);
        echo 'Forbidden';
        return;
    }

    $amount = trim((string) ($_POST['amount'] ?? ''));
    $orderId = trim((string) ($_POST['order_id'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));

    if ($amount === '' || !is_numeric($amount) || (float) $amount <= 0) {
        http_response_code(400);
        echo 'Invalid amount';
        return;
    }

    if ($orderId === '') {
        $orderId = 'tilda-' . bin2hex(random_bytes(6));
    }

    if (!str_starts_with($orderId, 'tilda-')) {
        $orderId = 'tilda-' . $orderId;
    }

    $client = new NorenApiClient(
        (string) $config['api_base_url'],
        (string) $config['api_public_key'],
        (string) $config['api_secret_key'],
    );

    try {
        $invoice = $client->createInvoice([
            'project_id' => (string) $config['project_id'],
            'merchant_order_id' => $orderId,
            'amount_fiat' => $amount,
            'fiat_currency' => (string) ($config['fiat_currency'] ?? 'USD'),
            'crypto_currency' => (string) ($config['crypto_currency'] ?? 'USDT'),
            'network' => (string) ($config['network'] ?? 'TRC20'),
            'metadata' => [
                'source' => 'tilda-bridge',
                'email' => $email,
            ],
        ]);
    } catch (Throwable $exception) {
        http_response_code(502);
        echo 'Payment error: ' . $exception->getMessage();
        return;
    }

    saveOrder($config, $orderId, [
        'order_id' => $orderId,
        'invoice_id' => (string) ($invoice['id'] ?? ''),
        'status' => (string) ($invoice['status'] ?? 'pending'),
        'amount' => $amount,
        'email' => $email,
        'created_at' => gmdate('c'),
    ]);

    $paymentUrl = (string) ($invoice['payment_page_url'] ?? '');
    if ($paymentUrl === '') {
        http_response_code(502);
        echo 'No payment_page_url in response';
        return;
    }

    header('Location: ' . $paymentUrl, true, 302);
}

/** @param array<string, mixed> $config */
function handleWebhook(array $config): void
{
    $rawBody = file_get_contents('php://input') ?: '';
    $signature = $_SERVER['HTTP_X_MERSET_SIGNATURE'] ?? null;
    $secret = (string) ($config['webhook_secret'] ?? '');

    if ($secret !== '' && !NorenWebhookVerifier::verify($rawBody, is_string($signature) ? $signature : null, $secret)) {
        http_response_code(401);
        echo json_encode(['error' => 'invalid_signature']);
        return;
    }

    $payload = NorenWebhookVerifier::parsePayload($rawBody);
    if ($payload === null) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_payload']);
        return;
    }

    $invoice = $payload['invoice'] ?? null;
    if (is_array($invoice)) {
        $orderId = (string) ($invoice['merchant_order_id'] ?? '');
        if (str_starts_with($orderId, 'tilda-')) {
            $existing = loadOrder($config, $orderId) ?? ['order_id' => $orderId];
            $existing['status'] = (string) ($invoice['status'] ?? '');
            $existing['invoice_id'] = (string) ($invoice['id'] ?? ($existing['invoice_id'] ?? ''));
            $existing['updated_at'] = gmdate('c');
            saveOrder($config, $orderId, $existing);
        }
    }

    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
}

/** @param array<string, mixed> $config */
function showOrderStatus(array $config, string $orderId): void
{
    if (!str_starts_with($orderId, 'tilda-')) {
        $orderId = 'tilda-' . $orderId;
    }
    $order = loadOrder($config, $orderId);
    header('Content-Type: application/json');
    echo json_encode($order ?? ['error' => 'not_found']);
}

/** @param array<string, mixed> $config @param array<string, mixed> $data */
function saveOrder(array $config, string $orderId, array $data): void
{
    $dir = (string) ($config['orders_dir'] ?? __DIR__ . '/data/orders');
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    file_put_contents($dir . '/' . md5($orderId) . '.json', json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

/** @param array<string, mixed> $config @return array<string, mixed>|null */
function loadOrder(array $config, string $orderId): ?array
{
    $dir = (string) ($config['orders_dir'] ?? __DIR__ . '/data/orders');
    $file = $dir . '/' . md5($orderId) . '.json';
    if (!is_file($file)) {
        return null;
    }
    $decoded = json_decode((string) file_get_contents($file), true);
    return is_array($decoded) ? $decoded : null;
}
