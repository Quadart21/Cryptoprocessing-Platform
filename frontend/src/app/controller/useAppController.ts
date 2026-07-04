import { FormEvent, useEffect, useState } from "react";

import {
  approveTenant,
  changeClientPassword,
  createAdminUser,
  deleteAdminUser,
  createClientPayout,
  createInvoice,
  createTenant,
  disableTwoFactor,
  enableTwoFactor,
  fetchAdminAssets,
  fetchAdminEvents,
  fetchAdminInvoiceDetail,
  fetchAdminInvoices,
  fetchAdminRoles,
  fetchAdminTransactions,
  fetchAdminUsers,
  fetchApiKeys,
  fetchBalance,
  fetchClientAccountingSummary,
  fetchClientInvoiceDetail,
  fetchClientNotificationSettings,
  fetchClientPayouts,
  fetchClientTransactions,
  fetchCurrentUser,
  fetchInvoiceEvents,
  fetchInvoices,
  fetchOnboardingStatus,
  fetchPlatformAccountingSummary,
  fetchPlatformBillingSettings,
  fetchProjects,
  fetchRates,
  fetchTenantAccountingSummary,
  fetchTenantBillingPolicy,
  fetchTenantDetail,
  fetchTenantInvoices,
  fetchTenantPayouts,
  fetchTenantTransactions,
  fetchTenants,
  fetchTwoFactorStatus,
  fetchWebhookConfigs,
  inspectPlatformTelegramBot,
  login,
  regenerateAdminApiKey,
  regenerateClientApiKey,
  register,
  rejectTenant,
  reviewAdminPayout,
  revokeAdminApiKey,
  revokeClientApiKey,
  sendPlatformSmtpBzTest,
  sendPlatformTelegramTest,
  sendWebhookTest,
  setupTwoFactor,
  syncClientInvoice,
  updateAdminProject,
  updateAdminTenant,
  updateAdminAssetAvailability,
  updateAdminInvoiceStatus,
  updateAdminUser,
  updateClientNotificationSettings,
  updatePlatformBillingSettings,
  updateTenantBillingPolicy,
  updateWebhookConfig,
  deleteAdminTenant,
  type AccountingSummary,
  type AdminUserCreatePayload,
  type AdminUserItem,
  type AdminUserUpdatePayload,
  type ApiKeyItem,
  type AssetAvailabilityPayload,
  type BalanceResponse,
  type CreateInvoicePayload,
  type CreatePayoutPayload,
  type InvoiceAdminDetail,
  type InvoiceItem,
  type MerchantNotificationSettings,
  type OnboardingStatus,
  type PayoutRequestItem,
  type PlatformBillingSettings,
  type ProjectItem,
  type ProviderEventItem,
  type RateItem,
  type RegistrationPayload,
  type SmtpBzTestPayload,
  type SmtpBzTestResponse,
  type TelegramAdminTestPayload,
  type TelegramAdminTestResponse,
  type TelegramBotIdentity,
  type TelegramBotInspectPayload,
  type TenantBillingPolicy,
  type TenantCreatePayload,
  type TenantCreateResponse,
  type TenantAdminUpdatePayload,
  type TenantDetailResponse,
  type TenantItem,
  type TransactionItem,
  type TwoFactorSetup,
  type TwoFactorStatus,
  type UserRoleDefinition,
  type WebhookConfigItem,
  type ProjectAdminUpdatePayload,
} from "../../api";
import {
  createMerchantOrderId,
  initialInvoiceForm,
  initialLoginForm,
  initialPayoutForm,
  initialRegistrationForm,
  initialTenantForm,
  initialWebhookForm,
} from "../../constants/forms";
import { useClientDashboard } from "../../hooks/useClientDashboard";
import { useSession } from "../../hooks/useSession";
import { safeLoad } from "../../utils/async";
import { type PublicPage, resolvePublicPage, setPublicPageHash } from "../publicPage";

const PLATFORM_ROLES = new Set([
  "superadmin",
  "platform_admin",
  "platform_finance",
  "platform_support",
]);

function isPlatformRole(role: string): boolean {
  return PLATFORM_ROLES.has(role);
}

export function useAppController() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [publicPage, setPublicPage] = useState<PublicPage>(() => resolvePublicPage());
  const { token, user, setUser, applyAccessToken, clearSession } = useSession();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedClientInvoiceId, setSelectedClientInvoiceId] = useState<string | null>(null);
  const [selectedClientInvoiceDetail, setSelectedClientInvoiceDetail] = useState<InvoiceItem | null>(
    null,
  );
  const [clientTransactions, setClientTransactions] = useState<TransactionItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequestItem[]>([]);
  const [clientAccounting, setClientAccounting] = useState<AccountingSummary | null>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [rates, setRates] = useState<RateItem[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfigItem[]>([]);
  const [createdTenant, setCreatedTenant] = useState<TenantCreateResponse | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTenantDetail, setSelectedTenantDetail] = useState<TenantDetailResponse | null>(
    null,
  );
  const [selectedTenantInvoices, setSelectedTenantInvoices] = useState<InvoiceItem[]>([]);
  const [selectedTenantTransactions, setSelectedTenantTransactions] = useState<TransactionItem[]>([]);
  const [selectedTenantPayouts, setSelectedTenantPayouts] = useState<PayoutRequestItem[]>([]);
  const [selectedTenantAccounting, setSelectedTenantAccounting] = useState<AccountingSummary | null>(
    null,
  );
  const [platformAccounting, setPlatformAccounting] = useState<AccountingSummary | null>(null);
  const [platformInvoices, setPlatformInvoices] = useState<InvoiceItem[]>([]);
  const [platformTransactions, setPlatformTransactions] = useState<TransactionItem[]>([]);
  const [platformEvents, setPlatformEvents] = useState<ProviderEventItem[]>([]);
  const [platformBillingSettings, setPlatformBillingSettings] =
    useState<PlatformBillingSettings | null>(null);
  const [selectedTenantBillingPolicy, setSelectedTenantBillingPolicy] =
    useState<TenantBillingPolicy | null>(null);
  const [adminAssetRates, setAdminAssetRates] = useState<RateItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<UserRoleDefinition[]>([]);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [clientNotificationSettings, setClientNotificationSettings] =
    useState<MerchantNotificationSettings | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<InvoiceAdminDetail | null>(null);
  const [selectedInvoiceEvents, setSelectedInvoiceEvents] = useState<ProviderEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newApiSecret, setNewApiSecret] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [tenantForm, setTenantForm] = useState<TenantCreatePayload>(initialTenantForm);
  const [registrationForm, setRegistrationForm] =
    useState<RegistrationPayload>(initialRegistrationForm);
  const [webhookForm, setWebhookForm] = useState(initialWebhookForm);
  const [invoiceForm, setInvoiceForm] = useState<CreateInvoicePayload>(initialInvoiceForm);
  const [payoutForm, setPayoutForm] = useState<CreatePayoutPayload>(initialPayoutForm);

  function resetClientState() {
    setProjects([]);
    setApiKeys([]);
    setInvoices([]);
    setClientTransactions([]);
    setPayouts([]);
    setClientAccounting(null);
    setBalance(null);
    setRates([]);
    setWebhookConfigs([]);
    setOnboarding(null);
    setClientNotificationSettings(null);
    setSelectedClientInvoiceId(null);
    setSelectedClientInvoiceDetail(null);
    setPayoutForm(initialPayoutForm);
  }

  function resetAdminState() {
    setTenants([]);
    setSelectedTenantId(null);
    setSelectedTenantDetail(null);
    setSelectedTenantInvoices([]);
    setSelectedTenantTransactions([]);
    setSelectedTenantPayouts([]);
    setSelectedTenantAccounting(null);
    setPlatformAccounting(null);
    setPlatformInvoices([]);
    setPlatformTransactions([]);
    setPlatformEvents([]);
    setPlatformBillingSettings(null);
    setSelectedTenantBillingPolicy(null);
    setAdminAssetRates([]);
    setAdminUsers([]);
    setRoleDefinitions([]);
    setSelectedInvoiceId(null);
    setSelectedInvoiceDetail(null);
    setSelectedInvoiceEvents([]);
  }

  function resetSecurityState() {
    setTwoFactorStatus(null);
    setTwoFactorSetup(null);
  }

  function clearRuntimeState() {
    setError(null);
    setSuccess(null);
    setNewApiSecret(null);
  }

  async function syncSelectedAdminInvoice(accessToken: string, invoiceIds: InvoiceItem[]) {
    if (invoiceIds.length === 0) {
      setSelectedInvoiceId(null);
      setSelectedInvoiceDetail(null);
      setSelectedInvoiceEvents([]);
      return;
    }

    const invoiceId = selectedInvoiceId ?? invoiceIds[0].id;
    setSelectedInvoiceId(invoiceId);
    setSelectedInvoiceDetail(await fetchAdminInvoiceDetail(accessToken, invoiceId));
    setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(accessToken, invoiceId), []));
  }

  async function loadSelectedTenant(accessToken: string, tenantId: string) {
    const [detail, tenantInvoices] = await Promise.all([
      fetchTenantDetail(accessToken, tenantId),
      fetchTenantInvoices(accessToken, tenantId),
    ]);
    const [tenantTransactions, tenantPayoutItems, tenantSummary, tenantPolicy] = await Promise.all([
      safeLoad(() => fetchTenantTransactions(accessToken, tenantId), []),
      safeLoad(() => fetchTenantPayouts(accessToken, tenantId), []),
      safeLoad(() => fetchTenantAccountingSummary(accessToken, tenantId), null),
      safeLoad(() => fetchTenantBillingPolicy(accessToken, tenantId), null),
    ]);

    setSelectedTenantId(tenantId);
    setSelectedTenantDetail(detail);
    setSelectedTenantInvoices(tenantInvoices);
    setSelectedTenantTransactions(tenantTransactions);
    setSelectedTenantPayouts(tenantPayoutItems);
    setSelectedTenantAccounting(tenantSummary);
    setSelectedTenantBillingPolicy(tenantPolicy);

    await syncSelectedAdminInvoice(accessToken, tenantInvoices);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleHashChange() {
      setPublicPage(resolvePublicPage());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      resetClientState();
      resetAdminState();
      resetSecurityState();
      return;
    }

    void loadSession(token);
  }, [token]);

  useEffect(() => {
    if (projects.length > 0 && !invoiceForm.project_id) {
      setInvoiceForm((current) => ({ ...current, project_id: projects[0].id }));
    }
  }, [projects, invoiceForm.project_id]);

  useEffect(() => {
    if (projects.length > 0 && !webhookForm.project_id) {
      setWebhookForm((current) => ({ ...current, project_id: projects[0].id }));
    }
  }, [projects, webhookForm.project_id]);

  useEffect(() => {
    if (projects.length > 0 && !payoutForm.project_id) {
      setPayoutForm((current) => ({ ...current, project_id: projects[0].id }));
    }
  }, [projects, payoutForm.project_id]);

  useEffect(() => {
    if (rates.length === 0) {
      return;
    }

    const hasSelectedCurrency = rates.some((item) => item.currency === invoiceForm.crypto_currency);
    const safeCurrency = hasSelectedCurrency ? invoiceForm.crypto_currency : rates[0].currency;
    const selectedRate = rates.find((item) => item.currency === safeCurrency) ?? rates[0];
    const availableNetworks = selectedRate.networks.filter((item) => item.availability && item.acquiring);
    const fallbackNetwork =
      availableNetworks[0]?.network ?? selectedRate.networks[0]?.network ?? invoiceForm.network;
    const hasSelectedNetwork = availableNetworks.some((item) => item.network === invoiceForm.network);
    const safeNetwork = hasSelectedNetwork ? invoiceForm.network : fallbackNetwork;

    if (safeCurrency !== invoiceForm.crypto_currency || safeNetwork !== invoiceForm.network) {
      setInvoiceForm((current) => ({ ...current, crypto_currency: safeCurrency, network: safeNetwork }));
    }
  }, [rates, invoiceForm.crypto_currency, invoiceForm.network]);

  useEffect(() => {
    if (!webhookForm.project_id) {
      return;
    }

    const currentConfig = webhookConfigs.find((item) => item.project_id === webhookForm.project_id);
    setWebhookForm((current) => ({ ...current, webhook_url: currentConfig?.webhook_url ?? "" }));
  }, [webhookConfigs, webhookForm.project_id]);

  async function loadMerchantDeferredData(accessToken: string) {
    const [accountingSummary, ratesResponse, webhookItems, notificationSettings, twoFactor] =
      await Promise.all([
        safeLoad(() => fetchClientAccountingSummary(accessToken), null),
        safeLoad(() => fetchRates(accessToken), { items: [] }),
        safeLoad(() => fetchWebhookConfigs(accessToken), []),
        safeLoad(() => fetchClientNotificationSettings(accessToken), null),
        safeLoad(() => fetchTwoFactorStatus(accessToken), null),
      ]);
    setClientAccounting(accountingSummary);
    setRates(ratesResponse.items);
    setWebhookConfigs(webhookItems);
    setClientNotificationSettings(notificationSettings);
    setTwoFactorStatus(twoFactor);
  }

  async function loadSession(accessToken: string) {
    try {
      setLoading(true);
      setError(null);

      const currentUser = await fetchCurrentUser(accessToken);
      setUser(currentUser);
      setTwoFactorSetup(null);
      setClientNotificationSettings(null);

      if (isPlatformRole(currentUser.role)) {
        resetClientState();

        const tenantItems = await fetchTenants(accessToken);
        setTenants(tenantItems);

        const [platformSummary, allInvoices, allTransactions, allEvents, billingSettings, assetRatesResponse, roleItems, userItems] =
          await Promise.all([
            fetchPlatformAccountingSummary(accessToken),
            fetchAdminInvoices(accessToken),
            fetchAdminTransactions(accessToken),
            safeLoad(() => fetchAdminEvents(accessToken), []),
            fetchPlatformBillingSettings(accessToken),
            fetchAdminAssets(accessToken),
            fetchAdminRoles(accessToken),
            fetchAdminUsers(accessToken, { scope: "platform" }),
          ]);

        setPlatformAccounting(platformSummary);
        setPlatformInvoices(allInvoices);
        setPlatformTransactions(allTransactions);
        setPlatformEvents(allEvents);
        setPlatformBillingSettings(billingSettings);
        setAdminAssetRates(assetRatesResponse.items);
        setRoleDefinitions(roleItems);
        setAdminUsers(userItems);
        setOnboarding(null);

        if (tenantItems.length > 0) {
          await loadSelectedTenant(accessToken, selectedTenantId ?? tenantItems[0].id);
        } else {
          setSelectedTenantBillingPolicy(null);
          setSelectedTenantDetail(null);
          setSelectedTenantInvoices([]);
          setSelectedTenantTransactions([]);
          setSelectedTenantPayouts([]);
          setSelectedTenantAccounting(null);
          setSelectedInvoiceId(null);
          setSelectedInvoiceDetail(null);
          setSelectedInvoiceEvents([]);
        }

        return;
      }

      resetAdminState();

      const onboardingStatus = await fetchOnboardingStatus(accessToken);
      setOnboarding(onboardingStatus);

      if (onboardingStatus.tenant_status === "approved") {
        const [projectItems, apiKeyItems, invoiceItems, balanceInfo, transactionItems, payoutItems] =
          await Promise.all([
            fetchProjects(accessToken),
            fetchApiKeys(accessToken),
            fetchInvoices(accessToken),
            fetchBalance(accessToken),
            fetchClientTransactions(accessToken),
            fetchClientPayouts(accessToken),
          ]);

        setProjects(projectItems);
        setApiKeys(apiKeyItems);
        setInvoices(invoiceItems);
        setBalance(balanceInfo);
        setClientTransactions(transactionItems);
        setPayouts(payoutItems);

        if (invoiceItems.length > 0) {
          setSelectedClientInvoiceId(selectedClientInvoiceId ?? invoiceItems[0].id);
        } else {
          setSelectedClientInvoiceId(null);
        }
        setSelectedClientInvoiceDetail(null);
        setLoading(false);
        void loadMerchantDeferredData(accessToken);
      } else {
        resetClientState();
        setOnboarding(onboardingStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить сессию.");
      clearSession();
    } finally {
      setLoading(false);
    }
  }

  async function refreshTwoFactorState(currentToken: string) {
    const [statusPayload, currentUser] = await Promise.all([
      fetchTwoFactorStatus(currentToken),
      fetchCurrentUser(currentToken),
    ]);
    setTwoFactorStatus(statusPayload);
    setUser(currentUser);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      const auth = await login(loginForm.email, loginForm.password, loginForm.otp_code);
      applyAccessToken(auth.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      clearRuntimeState();
      const result = await register(registrationForm);
      setSuccess(result.message);
      setMode("login");
      setLoginForm({
        email: registrationForm.owner_email,
        password: registrationForm.password,
        otp_code: "",
      });
      setRegistrationForm(initialRegistrationForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка подключения проекта.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const result = await createTenant(token, tenantForm);
      setCreatedTenant(result);
      setTenantForm(initialTenantForm);
      setTenants(await fetchTenants(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать клиента.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAdminUser(payload: AdminUserCreatePayload) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const result = await createAdminUser(token, payload);
      setAdminUsers(await fetchAdminUsers(token, { scope: "platform" }));
      setSuccess(
        `Пользователь ${result.user.email} создан. Данные для входа отправлены на указанную почту.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать пользователя.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAdminUser(userId: string, payload: AdminUserUpdatePayload) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await updateAdminUser(token, userId, payload);
      setAdminUsers(await fetchAdminUsers(token, { scope: "platform" }));
      setSuccess("Пользователь обновлен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить пользователя.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAdminUser(userId: string) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await deleteAdminUser(token, userId);
      setAdminUsers(await fetchAdminUsers(token, { scope: "platform" }));
      setSuccess("Администратор удален.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить администратора.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupTwoFactor() {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const setup = await setupTwoFactor(token);
      setTwoFactorSetup(setup);
      await refreshTwoFactorState(token);
      setSuccess("Секрет 2FA сгенерирован. Подтвердите код из Google Authenticator.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить настройку 2FA.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableTwoFactor(code: string) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await enableTwoFactor(token, code);
      await refreshTwoFactorState(token);
      setSuccess("2FA успешно включен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось включить 2FA.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisableTwoFactor(payload: { password: string; code?: string }) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await disableTwoFactor(token, payload);
      setTwoFactorSetup(null);
      await refreshTwoFactorState(token);
      setSuccess("2FA отключен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отключить 2FA.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateClientNotificationSettings(payload: {
    notify_email_enabled: boolean;
    notify_telegram_enabled: boolean;
    telegram_chat_id: string | null;
  }) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      setClientNotificationSettings(await updateClientNotificationSettings(token, payload));
      setSuccess("Настройки уведомлений обновлены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить настройки уведомлений.");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeClientPassword(payload: {
    current_password: string;
    new_password: string;
  }) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const result = await changeClientPassword(token, payload);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить пароль.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveTenant(tenantId: string) {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      setNewApiSecret(null);
      const result = await approveTenant(token, tenantId, "Одобрено супер-админом.");
      setSuccess(
        `Заявка одобрена. Public key: ${result.api_public_key}. Secret key: ${result.api_secret_key}. Password: ${result.generated_password}`,
      );
      setTenants(await fetchTenants(token));
      await loadSelectedTenant(token, tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось одобрить заявку.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectTenant(tenantId: string) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await rejectTenant(token, tenantId, "Заявка отклонена супер-админом.");
      setTenants(await fetchTenants(token));
      await loadSelectedTenant(token, tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить заявку.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAdminTenant(tenantId: string, payload: TenantAdminUpdatePayload) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const detail = await updateAdminTenant(token, tenantId, payload);
      setSelectedTenantDetail(detail);
      setTenants(await fetchTenants(token));
      setSuccess("Данные мерчанта обновлены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить мерчанта.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAdminProject(projectId: string, payload: ProjectAdminUpdatePayload) {
    if (!token || !selectedTenantId) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const updatedProject = await updateAdminProject(token, projectId, payload);
      setSelectedTenantDetail((current) =>
        current
          ? {
              ...current,
              projects: current.projects.map((project) =>
                project.id === projectId ? updatedProject : project,
              ),
            }
          : current,
      );
      setSuccess("Проект обновлен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить проект.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAdminTenant(tenantId: string) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await deleteAdminTenant(token, tenantId);
      setTenants(await fetchTenants(token));
      if (selectedTenantId === tenantId) {
        setSelectedTenantId(null);
        setSelectedTenantDetail(null);
        setSelectedTenantInvoices([]);
        setSelectedTenantTransactions([]);
        setSelectedTenantPayouts([]);
        setSelectedTenantAccounting(null);
        setSelectedTenantBillingPolicy(null);
        setSelectedInvoiceId(null);
        setSelectedInvoiceDetail(null);
        setSelectedInvoiceEvents([]);
      }
      setSuccess("Мерчант удален.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить мерчанта.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const merchantOrderId = invoiceForm.merchant_order_id.trim() || createMerchantOrderId();

    try {
      setLoading(true);
      clearRuntimeState();
      const invoice = await createInvoice(token, {
        ...invoiceForm,
        merchant_order_id: merchantOrderId,
      });
      setSuccess(`Инвойс создан: ${invoice.provider_order_id}`);

      const [invoiceItems, balanceInfo, transactionItems, accountingSummary, webhookItems] =
        await Promise.all([
          fetchInvoices(token),
          fetchBalance(token),
          fetchClientTransactions(token),
          fetchClientAccountingSummary(token),
          fetchWebhookConfigs(token),
        ]);

      setInvoices(invoiceItems);
      setBalance(balanceInfo);
      setClientTransactions(transactionItems);
      setClientAccounting(accountingSummary);
      setWebhookConfigs(webhookItems);

      if (invoiceItems.length > 0) {
        setSelectedClientInvoiceId(invoice.id);
        setSelectedClientInvoiceDetail(await fetchClientInvoiceDetail(token, invoice.id));
      }

      setInvoiceForm((current) => ({
        ...current,
        merchant_order_id: createMerchantOrderId(),
        amount_fiat: 100,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать инвойс.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!payoutForm.project_id) {
      setError("Выберите проект для вывода.");
      return;
    }

    try {
      setLoading(true);
      clearRuntimeState();
      await createClientPayout(token, payoutForm);
      const [payoutItems, balanceInfo] = await Promise.all([
        fetchClientPayouts(token),
        fetchBalance(token),
      ]);
      setPayouts(payoutItems);
      setBalance(balanceInfo);
      setSuccess("Запрос на вывод отправлен и ожидает проверки администратора.");
      setPayoutForm((current) => ({ ...initialPayoutForm, project_id: current.project_id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить запрос на вывод.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const result = await updateWebhookConfig(token, webhookForm);
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
  }

  async function handleSendWebhookTest() {
    if (!token) return;
    if (!webhookForm.project_id) {
      setError("Выберите проект для тестовой отправки webhook.");
      return;
    }

    try {
      setLoading(true);
      clearRuntimeState();
      const result = await sendWebhookTest(token, { project_id: webhookForm.project_id });
      setSuccess(
        `Тестовый webhook доставлен (HTTP ${result.status_code}, попыток: ${result.attempts}, event: ${result.event_id}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить тестовый webhook.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setCreatedTenant(null);
    clearRuntimeState();
    resetAdminState();
    resetClientState();
    resetSecurityState();
  }

  async function handleSelectTenant(tenantId: string) {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      setSelectedTenantId(tenantId);
      const [allInvoices, allTransactions, allEvents] = await Promise.all([
        fetchAdminInvoices(token),
        fetchAdminTransactions(token),
        safeLoad(() => fetchAdminEvents(token), []),
      ]);

      setPlatformInvoices(allInvoices);
      setPlatformTransactions(allTransactions);
      setPlatformEvents(allEvents);

      await loadSelectedTenant(token, tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить карточку клиента.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectInvoice(invoiceId: string) {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      setSelectedInvoiceId(invoiceId);
      setSelectedInvoiceDetail(await fetchAdminInvoiceDetail(token, invoiceId));
      setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, invoiceId), []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить инвойс.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateInvoiceStatus(status: string) {
    if (!token || !selectedInvoiceId || !selectedTenantId) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const updated = await updateAdminInvoiceStatus(token, selectedInvoiceId, status);
      setSelectedInvoiceDetail(updated);
      setSelectedTenantInvoices(await fetchTenantInvoices(token, selectedTenantId));
      setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, selectedInvoiceId), []));
      setPlatformEvents(await safeLoad(() => fetchAdminEvents(token), []));
      setSuccess(`Статус инвойса обновлен на ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус инвойса.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectClientInvoice(invoiceId: string) {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      setSelectedClientInvoiceId(invoiceId);
      setSelectedClientInvoiceDetail(await fetchClientInvoiceDetail(token, invoiceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить детали инвойса.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClientInvoiceSync(invoiceId: string) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      const invoice = await syncClientInvoice(token, invoiceId);
      const [invoiceItems, transactionItems, accountingSummary, balanceInfo] = await Promise.all([
        fetchInvoices(token),
        fetchClientTransactions(token),
        fetchClientAccountingSummary(token),
        fetchBalance(token),
      ]);
      setInvoices(invoiceItems);
      setSelectedClientInvoiceId(invoice.id);
      setSelectedClientInvoiceDetail(invoice);
      setClientTransactions(transactionItems);
      setClientAccounting(accountingSummary);
      setBalance(balanceInfo);
      setSuccess(`Статус инвойса синхронизирован: ${invoice.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось синхронизировать инвойс.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClientRevokeApiKey(apiKeyId: string) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await revokeClientApiKey(token, apiKeyId);
      setApiKeys(await fetchApiKeys(token));
      setSuccess("API-ключ отозван.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отозвать API-ключ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClientRegenerateApiKey(apiKeyId: string) {
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
  }

  async function handleAdminRevokeApiKey(apiKeyId: string) {
    if (!token || !selectedTenantId) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await revokeAdminApiKey(token, apiKeyId);
      setSelectedTenantDetail(await fetchTenantDetail(token, selectedTenantId));
      setSuccess("API-ключ клиента отозван.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отозвать API-ключ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminRegenerateApiKey(apiKeyId: string) {
    if (!token || !selectedTenantId) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await regenerateAdminApiKey(token, apiKeyId);
      setSelectedTenantDetail(await fetchTenantDetail(token, selectedTenantId));
      setNewApiSecret(result.secret_key);
      setSuccess(`Ключ перевыпущен: ${result.public_key}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось перевыпустить API-ключ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePlatformSettings(next: PlatformBillingSettings) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
      setPlatformBillingSettings(await updatePlatformBillingSettings(token, next));
      setSuccess("Настройки комиссий платформы обновлены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить настройки платформы.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInspectPlatformTelegramBot(
    payload: TelegramBotInspectPayload,
  ): Promise<TelegramBotIdentity> {
    if (!token) {
      throw new Error("Требуется авторизация.");
    }

    try {
      setLoading(true);
      clearRuntimeState();
      return await inspectPlatformTelegramBot(token, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось проверить Telegram-бота.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPlatformTelegramTest(
    payload: TelegramAdminTestPayload,
  ): Promise<TelegramAdminTestResponse> {
    if (!token) {
      throw new Error("Требуется авторизация.");
    }

    try {
      setLoading(true);
      clearRuntimeState();
      const result = await sendPlatformTelegramTest(token, payload);
      setSuccess(
        `Тест Telegram отправлен в chat ${result.chat_id} (message_id: ${result.telegram_message_id ?? "-"})`,
      );
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось отправить тестовое Telegram-уведомление.",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPlatformSmtpBzTest(
    payload: SmtpBzTestPayload,
  ): Promise<SmtpBzTestResponse> {
    if (!token) {
      throw new Error("Требуется авторизация.");
    }

    try {
      setLoading(true);
      clearRuntimeState();
      const result = await sendPlatformSmtpBzTest(token, payload);
      setSuccess(`SMTP.bz тест отправлен на ${result.recipient_email}.`);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить тестовое SMTP.bz сообщение.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTenantPolicy(payload: Omit<TenantBillingPolicy, "tenant_id">) {
    if (!token || !selectedTenantId) return;

    try {
      setLoading(true);
      clearRuntimeState();
      setSelectedTenantBillingPolicy(await updateTenantBillingPolicy(token, selectedTenantId, payload));
      setSuccess("Индивидуальная комиссия клиента обновлена.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить правила клиента.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAssetAvailability(payload: AssetAvailabilityPayload) {
    if (!token) return;

    try {
      setLoading(true);
      clearRuntimeState();
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
  }

  async function handleApprovePayout(payoutId: string) {
    if (!token || !selectedTenantId) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await reviewAdminPayout(token, payoutId, {
        action: "approve",
        review_comment: "Одобрено супер-админом.",
      });
      const [tenantPayoutItems, tenantTransactions, tenantSummary] = await Promise.all([
        fetchTenantPayouts(token, selectedTenantId),
        fetchTenantTransactions(token, selectedTenantId),
        fetchTenantAccountingSummary(token, selectedTenantId),
      ]);
      setSelectedTenantPayouts(tenantPayoutItems);
      setSelectedTenantTransactions(tenantTransactions);
      setSelectedTenantAccounting(tenantSummary);
      setSuccess("Запрос на вывод одобрен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось одобрить запрос на вывод.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectPayout(payoutId: string) {
    if (!token || !selectedTenantId) return;

    try {
      setLoading(true);
      clearRuntimeState();
      await reviewAdminPayout(token, payoutId, {
        action: "reject",
        review_comment: "Отклонено супер-админом.",
      });
      const [tenantPayoutItems, tenantTransactions, tenantSummary] = await Promise.all([
        fetchTenantPayouts(token, selectedTenantId),
        fetchTenantTransactions(token, selectedTenantId),
        fetchTenantAccountingSummary(token, selectedTenantId),
      ]);
      setSelectedTenantPayouts(tenantPayoutItems);
      setSelectedTenantTransactions(tenantTransactions);
      setSelectedTenantAccounting(tenantSummary);
      setSuccess("Запрос на вывод отклонен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить запрос на вывод.");
    } finally {
      setLoading(false);
    }
  }

  const clientDerived = useClientDashboard({
    rates,
    invoiceForm,
    apiKeys,
    webhookConfigs,
    webhookProjectId: webhookForm.project_id,
  });


  function openPublicPage(nextPage: PublicPage) {
    setPublicPage(nextPage);
    setPublicPageHash(nextPage);
  }

  return {
    mode,
    setMode,
    publicPage,
    token,
    user,
    onboarding,
    loading,
    success,
    error,
    newApiSecret,
    loginForm,
    setLoginForm,
    registrationForm,
    setRegistrationForm,
    tenantForm,
    setTenantForm,
    webhookForm,
    setWebhookForm,
    invoiceForm,
    setInvoiceForm,
    payoutForm,
    setPayoutForm,
    projects,
    apiKeys,
    invoices,
    selectedClientInvoiceId,
    selectedClientInvoiceDetail,
    clientTransactions,
    payouts,
    clientAccounting,
    balance,
    rates,
    createdTenant,
    tenants,
    selectedTenantId,
    selectedTenantDetail,
    selectedTenantInvoices,
    selectedTenantTransactions,
    selectedTenantPayouts,
    selectedTenantAccounting,
    platformAccounting,
    platformInvoices,
    platformTransactions,
    platformEvents,
    platformBillingSettings,
    selectedTenantBillingPolicy,
    adminAssetRates,
    adminUsers,
    roleDefinitions,
    twoFactorStatus,
    twoFactorSetup,
    clientNotificationSettings,
    selectedInvoiceId,
    selectedInvoiceDetail,
    selectedInvoiceEvents,
    clientDerived,
    openPublicPage,
    handleLogin,
    handleRegister,
    handleLogout,
    handleCreateTenant,
    handleCreateAdminUser,
    handleUpdateAdminUser,
    handleDeleteAdminUser,
    handleCreateInvoice,
    handleCreatePayout,
    handleSaveWebhook,
    handleSendWebhookTest,
    handleSelectTenant,
    handleApproveTenant,
    handleRejectTenant,
    handleUpdateAdminTenant,
    handleUpdateAdminProject,
    handleDeleteAdminTenant,
    handleSelectInvoice,
    handleUpdateInvoiceStatus,
    handleSelectClientInvoice,
    handleClientInvoiceSync,
    handleClientRegenerateApiKey,
    handleClientRevokeApiKey,
    handleAdminRegenerateApiKey,
    handleAdminRevokeApiKey,
    handleSetupTwoFactor,
    handleEnableTwoFactor,
    handleDisableTwoFactor,
    handleUpdateClientNotificationSettings,
    handleChangeClientPassword,
    handleUpdatePlatformSettings,
    handleInspectPlatformTelegramBot,
    handleSendPlatformTelegramTest,
    handleSendPlatformSmtpBzTest,
    handleUpdateTenantPolicy,
    handleUpdateAssetAvailability,
    handleApprovePayout,
    handleRejectPayout,
    isPlatformRole,
  };
}
