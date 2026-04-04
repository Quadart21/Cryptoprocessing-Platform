import { useCallback, useState } from "react";

import {
  fetchAdminAssets,
  updateAdminAssetAvailability,
  type AssetAvailabilityPayload,
  type RateItem,
} from "../../api";

export function useAssetFlow(token: string | null) {
  const [adminAssetRates, setAdminAssetRates] = useState<RateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAdminAssets = useCallback(
    async (currentToken: string) => {
      setLoading(true);
      try {
        const response = await fetchAdminAssets(currentToken);
        setAdminAssetRates(response.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить активы.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleUpdateAssetAvailability = useCallback(
    async (payload: AssetAvailabilityPayload) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        await updateAdminAssetAvailability(token, payload);
        setAdminAssetRates((await fetchAdminAssets(token)).items);
        setSuccess(
          `Доступ ${payload.currency}/${payload.network} ${payload.platform_enabled ? "включен" : "отключен"}.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось изменить доступность токена и сети.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  return {
    adminAssetRates,
    loading,
    error,
    success,
    loadAdminAssets,
    handleUpdateAssetAvailability,
  };
}