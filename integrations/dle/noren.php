<?php
/**
 * Noren Digital — модуль оплаты для DataLife Engine (billing).
 *
 * Установка: скопируйте в engine/modules/billing/payment/noren.php
 * Webhook: engine/modules/billing/payment/noren_webhook.php (URL см. README)
 */

if (!defined('DATALIFEENGINE')) {
    header('HTTP/1.1 403 Forbidden');
    header('Location: ../../');
    die('Hacking attempt!');
}

require_once __DIR__ . '/vendor/noren/NorenApiClient.php';

class NOREN
{
    public static function config(): array
    {
        global $db;
        $row = $db->super_query("SELECT * FROM " . PREFIX . "_billing WHERE name='noren' LIMIT 1");
        if (!$row) {
            return [];
        }
        $settings = [];
        if (!empty($row['settings'])) {
            $settings = unserialize($row['settings'], ['allowed_classes' => false]);
            if (!is_array($settings)) {
                $settings = [];
            }
        }
        return $settings;
    }

    public static function admin(): string
    {
        $settings = self::config();
        $siteUrl = rtrim((string) config_http_home_url, '/');
        $webhookUrl = $siteUrl . '/engine/modules/billing/payment/noren_webhook.php';

        return '
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">API Base URL</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><input class="form-control" name="settings[api_base_url]" value="' . htmlspecialchars((string) ($settings['api_base_url'] ?? 'https://api.noren.digital/api/v1/client')) . '"></td></tr>
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">Project ID</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><input class="form-control" name="settings[project_id]" value="' . htmlspecialchars((string) ($settings['project_id'] ?? '')) . '"></td></tr>
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">API Public Key</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><input class="form-control" name="settings[api_public_key]" value="' . htmlspecialchars((string) ($settings['api_public_key'] ?? '')) . '"></td></tr>
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">API Secret Key</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><input type="password" class="form-control" name="settings[api_secret_key]" value="' . htmlspecialchars((string) ($settings['api_secret_key'] ?? '')) . '"></td></tr>
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">Webhook Secret</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><input type="password" class="form-control" name="settings[webhook_secret]" value="' . htmlspecialchars((string) ($settings['webhook_secret'] ?? '')) . '"></td></tr>
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">Криптовалюта</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><input class="form-control" name="settings[crypto_currency]" value="' . htmlspecialchars((string) ($settings['crypto_currency'] ?? 'USDT')) . '"></td></tr>
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">Сеть</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><input class="form-control" name="settings[network]" value="' . htmlspecialchars((string) ($settings['network'] ?? 'TRC20')) . '"></td></tr>
        <tr><td class="col-xs-6 col-sm-6 col-md-6 white-line">Webhook URL</td>
        <td class="col-xs-6 col-sm-6 col-md-6 white-line"><code>' . htmlspecialchars($webhookUrl) . '</code></td></tr>';
    }

    /**
     * @param float|int|string $amount
     * @param array<string, mixed> $info
     */
    public static function pay($amount, $info, $title): void
    {
        global $db, $member_id;

        $settings = self::config();
        $base = rtrim((string) ($settings['api_base_url'] ?? ''), '/');
        $public = (string) ($settings['api_public_key'] ?? '');
        $secret = (string) ($settings['api_secret_key'] ?? '');
        $projectId = (string) ($settings['project_id'] ?? '');

        if ($base === '' || $public === '' || $secret === '' || $projectId === '') {
            msgbox('Ошибка', 'Модуль Noren не настроен. Обратитесь к администратору.');
            return;
        }

        $invoiceId = (int) ($info['invoice'] ?? 0);
        if ($invoiceId <= 0) {
            msgbox('Ошибка', 'Не найден счёт billing.');
            return;
        }

        $merchantOrderId = 'dle-' . $invoiceId;
        $client = new NorenApiClient($base, $public, $secret);

        try {
            $invoice = $client->createInvoice([
                'project_id' => $projectId,
                'merchant_order_id' => $merchantOrderId,
                'amount_fiat' => (string) $amount,
                'fiat_currency' => (string) ($info['currency'] ?? 'USD'),
                'crypto_currency' => (string) ($settings['crypto_currency'] ?? 'USDT'),
                'network' => (string) ($settings['network'] ?? 'TRC20'),
                'metadata' => [
                    'source' => 'dle-billing',
                    'billing_invoice_id' => $invoiceId,
                    'user_id' => $member_id['user_id'] ?? null,
                    'title' => $title,
                ],
            ]);
        } catch (Throwable $exception) {
            msgbox('Ошибка оплаты', htmlspecialchars($exception->getMessage()));
            return;
        }

        $paymentUrl = (string) ($invoice['payment_page_url'] ?? '');
        if ($paymentUrl === '') {
            msgbox('Ошибка', 'API не вернул payment_page_url.');
            return;
        }

        $norenInvoiceId = $db->safesql((string) ($invoice['id'] ?? ''));
        $db->query("UPDATE " . PREFIX . "_billing_invoice SET pay_info='noren:" . $norenInvoiceId . "' WHERE id='{$invoiceId}'");

        header('Location: ' . $paymentUrl);
        die();
    }
}
