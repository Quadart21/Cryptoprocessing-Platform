import { useCallback, useState } from "react";

import {
  disableTwoFactor,
  enableTwoFactor,
  fetchCurrentUser,
  fetchTwoFactorStatus,
  setupTwoFactor,
  type TwoFactorSetup,
  type TwoFactorStatus,
} from "../../api";

export function useTwoFactorFlow(token: string | null) {
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshTwoFactorState = useCallback(async (currentToken: string) => {
    const [statusPayload, currentUser] = await Promise.all([
      fetchTwoFactorStatus(currentToken),
      fetchCurrentUser(currentToken),
    ]);
    setTwoFactorStatus(statusPayload);
    return currentUser;
  }, []);

  const loadTwoFactorStatus = useCallback(async (currentToken: string) => {
    setLoading(true);
    try {
      const status = await fetchTwoFactorStatus(currentToken);
      setTwoFactorStatus(status);
      setTwoFactorSetup(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить статус 2FA.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSetupTwoFactor = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const setup = await setupTwoFactor(token);
      setTwoFactorSetup(setup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить настройку 2FA.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleEnableTwoFactor = useCallback(
    async (code: string) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        await enableTwoFactor(token, code);
        await refreshTwoFactorState(token);
        setSuccess("2FA успешно включен.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось включить 2FA.");
      } finally {
        setLoading(false);
      }
    },
    [token, refreshTwoFactorState],
  );

  const handleDisableTwoFactor = useCallback(
    async (payload: { password: string; code?: string }) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        await disableTwoFactor(token, payload);
        setTwoFactorSetup(null);
        await refreshTwoFactorState(token);
        setSuccess("2FA отключен.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось отключить 2FA.");
      } finally {
        setLoading(false);
      }
    },
    [token, refreshTwoFactorState],
  );

  return {
    twoFactorStatus,
    twoFactorSetup,
    loading,
    error,
    success,
    loadTwoFactorStatus,
    refreshTwoFactorState,
    handleSetupTwoFactor,
    handleEnableTwoFactor,
    handleDisableTwoFactor,
  };
}