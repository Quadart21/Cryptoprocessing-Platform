import { useCallback, useState } from "react";

import {
  fetchPlatformBillingSettings,
  fetchTenantBillingPolicy,
  updatePlatformBillingSettings,
  updateTenantBillingPolicy,
  type PlatformBillingSettings,
  type TenantBillingPolicy,
} from "../../api";

export function useBillingFlow(token: string | null) {
  const [platformBillingSettings, setPlatformBillingSettings] =
    useState<PlatformBillingSettings | null>(null);
  const [selectedTenantBillingPolicy, setSelectedTenantBillingPolicy] =
    useState<TenantBillingPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPlatformBilling = useCallback(
    async (currentToken: string) => {
      setLoading(true);
      try {
        const settings = await fetchPlatformBillingSettings(currentToken);
        setPlatformBillingSettings(settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить настройки платформы.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadTenantBilling = useCallback(
    async (currentToken: string, tenantId: string) => {
      setLoading(true);
      try {
        const policy = await fetchTenantBillingPolicy(currentToken, tenantId);
        setSelectedTenantBillingPolicy(policy);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить политику клиента.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleUpdatePlatformSettings = useCallback(
    async (next: PlatformBillingSettings) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const updated = await updatePlatformBillingSettings(token, next);
        setPlatformBillingSettings(updated);
        setSuccess("Настройки комиссий платформы обновлены.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось обновить настройки платформы.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const handleUpdateTenantPolicy = useCallback(
    async (tenantId: string, payload: Omit<TenantBillingPolicy, "tenant_id">) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const updated = await updateTenantBillingPolicy(token, tenantId, payload);
        setSelectedTenantBillingPolicy(updated);
        setSuccess("Индивидуальная комиссия клиента обновлена.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось обновить правила клиента.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  return {
    platformBillingSettings,
    selectedTenantBillingPolicy,
    loading,
    error,
    success,
    loadPlatformBilling,
    loadTenantBilling,
    handleUpdatePlatformSettings,
    handleUpdateTenantPolicy,
  };
}