<?php
/**
 * Verifies outbound merchant webhooks (X-Merset-Signature).
 *
 * @see gitbook/webhooks.md
 */

declare(strict_types=1);

final class NorenWebhookVerifier
{
    public const SIGNATURE_HEADER = 'HTTP_X_MERSET_SIGNATURE';

    public static function verify(string $rawBody, ?string $signatureHeader, string $webhookSecret): bool
    {
        if ($signatureHeader === null || $signatureHeader === '') {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $webhookSecret);
        return hash_equals($expected, $signatureHeader);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function parsePayload(string $rawBody): ?array
    {
        /** @var array<string, mixed>|null $decoded */
        $decoded = json_decode($rawBody, true);
        return is_array($decoded) ? $decoded : null;
    }

    public static function isPaidStatus(string $status): bool
    {
        $normalized = strtolower(trim($status));
        return in_array($normalized, ['paid', 'confirmed', 'overpaid', 'underpaid'], true);
    }

    public static function isFailedStatus(string $status): bool
    {
        $normalized = strtolower(trim($status));
        return in_array($normalized, ['expired', 'cancelled', 'canceled', 'failed'], true);
    }
}
