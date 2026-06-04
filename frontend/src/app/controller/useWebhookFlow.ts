import { useCallback, useState } from "react";

import {
  fetchApiKeys,
  fetchWebhookConfigs,
  regenerateClientApiKey,
  revokeClientApiKey,
  sendWebhookTest,
  updateWebhookConfig,
  type ApiKeyItem,
  type WebhookConfigItem,
} from "../../api";
import { initialWebhookForm } from "../../constants/forms";

export function useWebhookFlow(token: string | null) {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfigItem[]>([]);
  const [webhookForm, setWebhookForm] = useState(initialWebhookForm);
  const [newApiSecret, setNewApiSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadApiKeys = useCallback(
    async (currentToken: string) => {
      setLoading(true);
      try {
        const keys = await fetchApiKeys(currentToken);
        setApiKeys(keys);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить ключи.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadWebhookConfigs = useCallback(
    async (currentToken: string) => {
      setLoading(true);
      try {
        const configs = await fetchWebhookConfigs(currentToken);
        setWebhookConfigs(configs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить webhook.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSaveWebhook = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const { checkout_delivery: _checkoutDelivery, ...webhookPayload } = webhookForm;
        const result = await updateWebhookConfig(token, webhookPayload);
        setWebhookConfigs(await fetchWebhookConfigs(token));
        setSuccess(
          `Webhook сохранен для проекта ${result.project_id}${result.has_secret ? " с секретом" : ""}.`,
        );
        setWebhookForm((current) => ({ ...current, webhook_secret: "" }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить webhook.");
      } finally {
        setLoading(false);
      }
    },
    [token, webhookForm],
  );

  const handleSendWebhookTest = useCallback(async () => {
    if (!token) return;
    if (!webhookForm.project_id) {
      setError("Выберите проект для тестовой отправки webhook.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await sendWebhookTest(token, { project_id: webhookForm.project_id });
      setSuccess(
        `Тестовый webhook доставлен (HTTP ${result.status_code}, попыток: ${result.attempts}, event: ${result.event_id}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить тестовый webhook.");
    } finally {
      setLoading(false);
    }
  }, [token, webhookForm]);

  const handleRevokeApiKey = useCallback(
    async (apiKeyId: string) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        await revokeClientApiKey(token, apiKeyId);
        setApiKeys(await fetchApiKeys(token));
        setSuccess("API-ключ отозван.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось отозвать API-ключ.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const handleRegenerateApiKey = useCallback(
    async (apiKeyId: string) => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const result = await regenerateClientApiKey(token, apiKeyId);
        setApiKeys(await fetchApiKeys(token));
        setNewApiSecret(result.secret_key);
        setSuccess(`Ключ перевыпущен: ${result.public_key}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось перевыпустить API-ключ.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  return {
    apiKeys,
    webhookConfigs,
    webhookForm,
    setWebhookForm,
    newApiSecret,
    loading,
    error,
    success,
    loadApiKeys,
    loadWebhookConfigs,
    handleSaveWebhook,
    handleSendWebhookTest,
    handleRevokeApiKey,
    handleRegenerateApiKey,
  };
}