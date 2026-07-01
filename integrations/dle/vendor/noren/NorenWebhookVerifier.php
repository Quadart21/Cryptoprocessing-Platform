<?php
/**
 * Verifies outbound merchant webhooks (X-Merset-Signature).
 */

declare(strict_types=1);

final class NorenWebhookVerifier
{
    public static function verify(string $rawBody, ?string $signatureHeader, string $webhookSecret): bool
    {
        if ($signatureHeader === null || $signatureHeader === '') {
            return false;
        }
        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $webhookSecret);
        return hash_equals($expected, $signatureHeader);
    }

    /** @return array<string, mixed>|null */
    public static function parsePayload(string $rawBody): ?array
    {
        $decoded = json_decode($rawBody, true);
        return is_array($decoded) ? $decoded : null;
    }

    public static function isPaidStatus(string $status): bool
    {
        $normalized = strtolower(trim($status));
        return in_array($normalized, ['paid', 'confirmed', 'overpaid', 'underpaid'], true);
    }
}
