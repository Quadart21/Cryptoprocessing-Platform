<?php
/** @see integrations/shared/php/NorenApiClient.php — копия для автономной установки DLE */

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

    /** @param array<string, mixed> $payload @return array<string, mixed> */
    public function createInvoice(array $payload): array
    {
        return $this->request('POST', '/invoices', $payload);
    }

    /** @param array<string, mixed>|null $body @return array<string, mixed> */
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
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false) {
            throw new RuntimeException('API request failed');
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Invalid JSON (HTTP ' . $status . ')');
        }
        if ($status >= 400) {
            throw new RuntimeException('API error HTTP ' . $status);
        }
        return $decoded;
    }
}
