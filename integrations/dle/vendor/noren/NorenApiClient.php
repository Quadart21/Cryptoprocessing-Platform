<?php
/**
 * Minimal HTTP client for Noren Digital / CryptoProcessing Merchant API.
 *
 * @see gitbook/quickstart.md
 */

declare(strict_types=1);

final class NorenApiClient
{
    private string $baseUrl;
    private string $publicKey;
    private string $secretKey;

    public function __construct(string $baseUrl, string $publicKey, string $secretKey)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->publicKey = $publicKey;
        $this->secretKey = $secretKey;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createInvoice(array $payload): array
    {
        return $this->request('POST', '/invoices', $payload);
    }

    /**
     * @return array<string, mixed>
     */
    public function getInvoice(string $invoiceId): array
    {
        return $this->request('GET', '/invoices/' . rawurlencode($invoiceId));
    }

    /**
     * @return array<string, mixed>
     */
    public function syncInvoice(string $invoiceId): array
    {
        return $this->request('POST', '/invoices/' . rawurlencode($invoiceId) . '/sync');
    }

    /**
     * @return array<string, mixed>
     */
    public function health(): array
    {
        return $this->request('GET', '/health');
    }

    /**
     * @param array<string, mixed>|null $body
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, ?array $body = null): array
    {
        $url = $this->baseUrl . $path;
        $headers = [
            'Accept: application/json',
            'Content-Type: application/json',
            'X-API-Key: ' . $this->publicKey,
            'X-API-Secret: ' . $this->secretKey,
            'User-Agent: NorenIntegration/1.0',
        ];

        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('curl_init failed');
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        if ($body !== null) {
            $encoded = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false) {
                throw new RuntimeException('Failed to encode JSON body');
            }
            curl_setopt($ch, CURLOPT_POSTFIELDS, $encoded);
        }

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            throw new RuntimeException('API request failed: ' . $error);
        }

        /** @var array<string, mixed>|null $decoded */
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Invalid JSON response (HTTP ' . $status . ')');
        }

        if ($status >= 400) {
            $message = isset($decoded['detail']) ? json_encode($decoded['detail'], JSON_UNESCAPED_UNICODE) : $raw;
            throw new RuntimeException('API error HTTP ' . $status . ': ' . (string) $message);
        }

        return $decoded;
    }
}
