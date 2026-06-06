import {
  approveTenant,
  changeClientPassword,
  createAdminUser,
  deleteAdminUser,
  createClientPayout,
  createInvoice,
  createMerchantSandbox,
  createTenant,
  deleteAdminTenant,
  destroyMerchantSandbox,
  disableTwoFactor,
  enableTwoFactor,
  fetchAdminAssets,
  fetchAdminEvents,
  fetchAdminInvoiceDetail,
  fetchAdminInvoices,
  fetchAdminPayouts,
  fetchAdminPublicPages,
  fetchAdminRoles,
  fetchAdminTransactions,
  fetchAdminUsers,
  fetchCsrfToken,
  fetchApiKeys,
  fetchBalance,
  fetchClientAccountingSummary,
  fetchClientInvoiceDetail,
  fetchClientNotificationSettings,
  fetchClientPayouts,
  fetchClientTransactions,
  fetchCurrentUser,
  fetchInvoiceEvents,
  fetchMerchantSandboxes,
  fetchInvoices,
  fetchOnboardingStatus,
  fetchPlatformAccountingOverview,
  recordPlatformEarningsWithdrawal,
  fetchSandboxPlatformSettings,
  fetchPlatformBillingSettings,
  fetchPlatformExchangeRate,
  provisionMerchantSandboxDns,
  refreshPlatformExchangeRate,
  fetchProjects,
  fetchRates,
  fetchTenantBillingPolicy,
  fetchTenantAccountingSummary,
  fetchTenantDetail,
  fetchTenantInvoices,
  fetchTenantPayouts,
  fetchTenantTransactions,
  fetchTenants,
  fetchTwoFactorStatus,
  fetchWebhookConfigs,
  inspectPlatformTelegramBot,
  login,
  requestPasswordRecovery,
  regenerateAdminApiKey,
  regenerateClientApiKey,
  register,
  rejectTenant,
  reviewAdminPayout,
  previewNotificationTemplate,
  resetAdminTenantOwnerPassword,
  resetAdminTenantOwnerTwoFactor,
  revokeAdminApiKey,
  revokeClientApiKey,
  sendNotificationTemplateTest,
  sendPlatformSmtpBzTest,
  sendPlatformTelegramTest,
  provisionOpsTelegramTopics,
  sendOpsTelegramTopicTest,
  sendInvoiceWebhookTest,
  sendWebhookTest,
  setPasswordByRecoveryToken,
  setupTwoFactor,
  syncAdminInvoice,
  repairAdminInvoiceSettlement,
  syncClientInvoice,
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
  type InvoiceDetail,
  type InvoiceItem,
  type MerchantSandboxCreatePayload,
  type MerchantSandboxCreateResponse,
  type MerchantSandboxSummary,
  type MerchantNotificationSettings,
  type NotificationTemplatePreview,
  type NotificationTemplatePreviewPayload,
  type NotificationTemplateTestPayload,
  type NotificationTemplateTestResponse,
  type OpsTelegramProvisionResponse,
  type OpsTelegramTopicTestPayload,
  type OpsTelegramTopicTestResponse,
  type OnboardingStatus,
  type PayoutRequestItem,
  type PlatformAccountingOverview,
  type PlatformEarningsWithdrawalPayload,
  type PlatformBillingSettings,
  type ProjectAdminUpdatePayload,
  type ProjectItem,
  type ProviderEventItem,
  type PublicPageItem,
  type RateItem,
  type SandboxPlatformSettings,
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
  updateAdminAssetAvailability,
  updateAdminInvoiceStatus,
  updateAdminProject,
  updateAdminTenant,
  updateAdminUser,
  updateClientNotificationSettings,
  updateSandboxPlatformSettings,
  updatePlatformBillingSettings,
  updateTenantBillingPolicy,
  updateWebhookConfig,
} from "./api";
import { isAdminSubdomain, isAppSubdomain, resolveDocsSiteUrl } from "./config/siteHost";
import {
  clearAuthQueryFromUrl,
  readAuthModeFromQuery,
} from "./config/siteHostRedirect";
import { useDedicatedSiteRedirect } from "./hooks/useDedicatedSiteRedirect";
import { AdminLoginShell } from "./admin/AdminLoginShell";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";

import {
  AdminDashboardLazy,
  ClientDashboardLazy,
  LandingPageLazy,
  OnboardingScreenLazy,
  PublicCmsPageLazy,
  PublicDocsPageLazy,
} from "./app/controller/lazyScreens";
import {
  createMerchantOrderId,
  initialInvoiceForm,
  initialLoginForm,
  initialPayoutForm,
  initialRegistrationForm,
  initialTenantForm,
  initialWebhookForm,
} from "./constants/forms";
import { useAdminDashboard } from "./hooks/useAdminDashboard";
import { useAdminPublicPagesCrud } from "./hooks/useAdminPublicPagesCrud";
import { useClientDashboard } from "./hooks/useClientDashboard";
import { usePublicSiteNavigation } from "./hooks/usePublicSiteNavigation";
import { useSession } from "./hooks/useSession";
import { AppRouteFallback } from "./components/AppRouteFallback";
import { safeLoad } from "./utils/async";
import { invoiceStatusLabelRu } from "./utils/invoiceStatus";

const PLATFORM_ROLES = new Set([
  "superadmin",
  "platform_admin",
  "platform_finance",
  "platform_support",
]);

function isPlatformRole(role: string): boolean {
  return PLATFORM_ROLES.has(role);
}

type AppControllerProps = {
  siteScope?: "default" | "admin";
};

export function AppController({ siteScope = "default" }: AppControllerProps) {
  const adminHost = siteScope === "admin" || isAdminSubdomain();
  const [mode, setMode] = useState<"login" | "register">("login");
  const { token, user, setUser, applyAccessToken, applyCsrfToken, clearSession, csrfToken } = useSession();
  const { publicRoute, publicNavigationItems, publicPageDetail, openPublicPage } =
    usePublicSiteNavigation({ authenticated: Boolean(token) && !adminHost });

  useDedicatedSiteRedirect({
    userRole: user?.role ?? null,
    adminHost,
    accessToken: token,
    csrfToken,
  });

  useEffect(() => {
    const authMode = readAuthModeFromQuery();
    if (!authMode) {
      return;
    }
    if (isAppSubdomain() || adminHost) {
      setMode(authMode);
      clearAuthQueryFromUrl();
    }
  }, [adminHost]);

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedClientInvoiceId, setSelectedClientInvoiceId] = useState<string | null>(null);
  const [selectedClientInvoiceDetail, setSelectedClientInvoiceDetail] = useState<InvoiceDetail | null>(
    null,
  );
  const [isClientInvoiceModalOpen, setIsClientInvoiceModalOpen] = useState(false);
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
  const [platformAccountingOverview, setPlatformAccountingOverview] =
    useState<PlatformAccountingOverview | null>(null);
  const [platformInvoices, setPlatformInvoices] = useState<InvoiceItem[]>([]);
  const [platformTransactions, setPlatformTransactions] = useState<TransactionItem[]>([]);
  const [platformPayouts, setPlatformPayouts] = useState<PayoutRequestItem[]>([]);
  const [platformEvents, setPlatformEvents] = useState<ProviderEventItem[]>([]);
  const [platformBillingSettings, setPlatformBillingSettings] =
    useState<PlatformBillingSettings | null>(null);
  const [selectedTenantBillingPolicy, setSelectedTenantBillingPolicy] =
    useState<TenantBillingPolicy | null>(null);
  const [adminAssetRates, setAdminAssetRates] = useState<RateItem[]>([]);
  const [adminPublicPages, setAdminPublicPages] = useState<PublicPageItem[]>([]);
  const [merchantSandboxes, setMerchantSandboxes] = useState<MerchantSandboxSummary[]>([]);
  const [sandboxPlatformSettings, setSandboxPlatformSettings] =
    useState<SandboxPlatformSettings | null>(null);
  const [lastMerchantSandboxCreate, setLastMerchantSandboxCreate] =
    useState<MerchantSandboxCreateResponse | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<UserRoleDefinition[]>([]);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [clientNotificationSettings, setClientNotificationSettings] =
    useState<MerchantNotificationSettings | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<InvoiceAdminDetail | null>(
    null,
  );
  const [selectedInvoiceEvents, setSelectedInvoiceEvents] = useState<ProviderEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newApiSecret, setNewApiSecret] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [loginStep, setLoginStep] = useState<"credentials" | "two-factor">("credentials");
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState("");
  const [passwordResetForm, setPasswordResetForm] = useState({
    token: "",
    password: "",
    confirmPassword: "",
  });
  const [tenantForm, setTenantForm] = useState<TenantCreatePayload>(initialTenantForm);
  const [registrationForm, setRegistrationForm] =
    useState<RegistrationPayload>(initialRegistrationForm);
  const [webhookForm, setWebhookForm] = useState(initialWebhookForm);
  const [invoiceForm, setInvoiceForm] = useState<CreateInvoicePayload>(initialInvoiceForm);
  const [payoutForm, setPayoutForm] = useState<CreatePayoutPayload>(initialPayoutForm);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setTenants([]);
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
      setSelectedTenantId(null);
      setSelectedTenantDetail(null);
      setSelectedTenantInvoices([]);
      setSelectedTenantTransactions([]);
      setSelectedTenantPayouts([]);
      setSelectedTenantAccounting(null);
      setPlatformInvoices([]);
      setPlatformTransactions([]);
      setPlatformPayouts([]);
      setPlatformEvents([]);
      setPlatformBillingSettings(null);
      setSelectedTenantBillingPolicy(null);
      setAdminAssetRates([]);
      setAdminPublicPages([]);
      setAdminUsers([]);
      setRoleDefinitions([]);
      setTwoFactorStatus(null);
      setTwoFactorSetup(null);
      setClientNotificationSettings(null);
      setSelectedInvoiceId(null);
      setSelectedInvoiceDetail(null);
      setSelectedInvoiceEvents([]);
      setSelectedClientInvoiceId(null);
      setSelectedClientInvoiceDetail(null);
      setIsClientInvoiceModalOpen(false);
      setPayoutForm(initialPayoutForm);
      return;
    }
    void loadSession(token);
  }, [token]);

  useEffect(() => {
    if (token) {
      return;
    }
    let cancelled = false;
    const warmPublicDocs = () => {
      if (!cancelled) {
        void import("./screens/PublicDocsPage");
      }
    };
    const handle =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(warmPublicDocs, { timeout: 4000 })
        : window.setTimeout(warmPublicDocs, 1800);
    return () => {
      cancelled = true;
      if (typeof requestIdleCallback === "function" && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(handle as number);
      } else {
        window.clearTimeout(handle as number);
      }
    };
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
    setWebhookForm((current) => ({
      ...current,
      webhook_url: currentConfig?.webhook_url ?? "",
      checkout_delivery: currentConfig?.checkout_delivery ?? "payment_page",
      return_url_success: currentConfig?.return_url_success ?? "",
      return_url_failed: currentConfig?.return_url_failed ?? "",
    }));
  }, [webhookConfigs, webhookForm.project_id]);

  useEffect(() => {
    if (!token || !user || !isPlatformRole(user.role)) {
      return;
    }

    let cancelled = false;
    const activeToken = token;

    async function refreshPlatformDashboard(sessionToken: string) {
      try {
        const [eventItems, accountingOverview] = await Promise.all([
          safeLoad(() => fetchAdminEvents(sessionToken), []),
          fetchPlatformAccountingOverview(sessionToken),
        ]);

        if (cancelled) {
          return;
        }

        setPlatformEvents(eventItems);
        setPlatformAccounting(accountingOverview.summary);
        setPlatformAccountingOverview(accountingOverview);

        if (selectedTenantId) {
          const tenantInvoices = await safeLoad(
            () => fetchTenantInvoices(sessionToken, selectedTenantId),
            [],
          );
          if (!cancelled) {
            setSelectedTenantInvoices(tenantInvoices);
          }
        }

        if (selectedInvoiceId) {
          const [detail, events] = await Promise.all([
            safeLoad(() => fetchAdminInvoiceDetail(sessionToken, selectedInvoiceId), null),
            safeLoad(() => fetchInvoiceEvents(sessionToken, selectedInvoiceId), []),
          ]);
          if (!cancelled) {
            if (detail) {
              setSelectedInvoiceDetail(detail);
            }
            setSelectedInvoiceEvents(events);
          }
        }
      } catch {
        // Background poll — не перекрываем UI ошибками автообновления.
      }
    }

    const timer = window.setInterval(() => {
      void refreshPlatformDashboard(activeToken);
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, user, selectedTenantId, selectedInvoiceId]);

  async function loadSession(accessToken: string) {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await fetchCurrentUser(accessToken);
      setUser(currentUser);
      setTwoFactorStatus(await safeLoad(() => fetchTwoFactorStatus(accessToken), null));
      setTwoFactorSetup(null);
      setClientNotificationSettings(null);

      if (isPlatformRole(currentUser.role)) {
        const { csrf_token } = await fetchCsrfToken(accessToken);
        applyCsrfToken(csrf_token);
        const tenantItems = await fetchTenants(accessToken);
        setTenants(tenantItems);
        if (tenantItems.length > 0) {
          const tenantId = selectedTenantId ?? tenantItems[0].id;
          setSelectedTenantId(tenantId);
          const [
            detail,
            tenantInvoices,
            tenantTransactions,
            tenantPayoutItems,
            tenantSummary,
            accountingOverview,
            allPayouts,
            allEvents,
            billingSettings,
            assetRatesResponse,
            publicPagesResponse,
            tenantBillingPolicy,
            roleItems,
            userItems,
          ] =
            await Promise.all([
              fetchTenantDetail(accessToken, tenantId),
              fetchTenantInvoices(accessToken, tenantId),
              fetchTenantTransactions(accessToken, tenantId),
              fetchTenantPayouts(accessToken, tenantId),
              fetchTenantAccountingSummary(accessToken, tenantId),
              fetchPlatformAccountingOverview(accessToken),
              fetchAdminPayouts(accessToken),
              safeLoad(() => fetchAdminEvents(accessToken), []),
              safeLoad(() => fetchPlatformBillingSettings(accessToken), null),
              safeLoad(() => fetchAdminAssets(accessToken), { items: [] }),
              safeLoad(() => fetchAdminPublicPages(accessToken), []),
              safeLoad(() => fetchTenantBillingPolicy(accessToken, tenantId), null),
              safeLoad(() => fetchAdminRoles(accessToken), []),
              safeLoad(() => fetchAdminUsers(accessToken, { scope: "platform" }), []),
            ]);
          setSelectedTenantDetail(detail);
          setSelectedTenantInvoices(tenantInvoices);
          setSelectedTenantTransactions(tenantTransactions);
          setSelectedTenantPayouts(tenantPayoutItems);
          setSelectedTenantAccounting(tenantSummary);
          setPlatformAccounting(accountingOverview.summary);
          setPlatformAccountingOverview(accountingOverview);
          setPlatformPayouts(allPayouts);
          setPlatformEvents(allEvents);
          setPlatformBillingSettings(billingSettings);
          setAdminAssetRates(assetRatesResponse.items);
          setAdminPublicPages(publicPagesResponse);
          setSelectedTenantBillingPolicy(tenantBillingPolicy);
          setRoleDefinitions(roleItems);
          setAdminUsers(userItems);
          if (tenantInvoices.length > 0) {
            const invoiceId = selectedInvoiceId ?? tenantInvoices[0].id;
            setSelectedInvoiceId(invoiceId);
            setSelectedInvoiceDetail(await fetchAdminInvoiceDetail(accessToken, invoiceId));
            setSelectedInvoiceEvents(await fetchInvoiceEvents(accessToken, invoiceId));
          } else {
            setSelectedInvoiceId(null);
            setSelectedInvoiceDetail(null);
            setSelectedInvoiceEvents([]);
          }
        } else {
          setSelectedTenantDetail(null);
          setSelectedTenantInvoices([]);
          setSelectedTenantTransactions([]);
          setSelectedTenantPayouts([]);
          setSelectedTenantAccounting(null);
          const [accountingOverview, allPayouts, allEvents, billingSettings, assetRatesResponse, publicPagesResponse, roleItems, userItems] =
            await Promise.all([
              fetchPlatformAccountingOverview(accessToken),
              fetchAdminPayouts(accessToken),
              safeLoad(() => fetchAdminEvents(accessToken), []),
              safeLoad(() => fetchPlatformBillingSettings(accessToken), null),
              safeLoad(() => fetchAdminAssets(accessToken), { items: [] }),
              safeLoad(() => fetchAdminPublicPages(accessToken), []),
              safeLoad(() => fetchAdminRoles(accessToken), []),
              safeLoad(() => fetchAdminUsers(accessToken, { scope: "platform" }), []),
            ]);
          setPlatformAccounting(accountingOverview.summary);
          setPlatformAccountingOverview(accountingOverview);
          setPlatformPayouts(allPayouts);
          setPlatformEvents(allEvents);
          setPlatformBillingSettings(billingSettings);
          setAdminAssetRates(assetRatesResponse.items);
          setAdminPublicPages(publicPagesResponse);
          setRoleDefinitions(roleItems);
          setAdminUsers(userItems);
          setSelectedTenantBillingPolicy(null);
          setSelectedInvoiceId(null);
          setSelectedInvoiceDetail(null);
          setSelectedInvoiceEvents([]);
        }
        if (currentUser.role === "superadmin") {
          try {
            const [sandboxList, sbSettings] = await Promise.all([
              fetchMerchantSandboxes(accessToken),
              fetchSandboxPlatformSettings(accessToken),
            ]);
            setMerchantSandboxes(sandboxList);
            setSandboxPlatformSettings(sbSettings);
          } catch {
            setMerchantSandboxes([]);
            setSandboxPlatformSettings(null);
          }
        } else {
          setMerchantSandboxes([]);
          setSandboxPlatformSettings(null);
        }
        setLastMerchantSandboxCreate(null);
        setOnboarding(null);
        setProjects([]);
        setApiKeys([]);
        setInvoices([]);
        setPayouts([]);
        setBalance(null);
        setRates([]);
        setWebhookConfigs([]);
        return;
      }

      setSelectedTenantId(null);
      setSelectedTenantDetail(null);
      setSelectedTenantInvoices([]);
      setSelectedTenantTransactions([]);
      setSelectedTenantPayouts([]);
      setSelectedTenantAccounting(null);
      setPlatformAccounting(null);
      setPlatformAccountingOverview(null);
      setPlatformInvoices([]);
      setPlatformTransactions([]);
      setPlatformEvents([]);
      setPlatformBillingSettings(null);
      setSelectedTenantBillingPolicy(null);
      setAdminAssetRates([]);
      setAdminPublicPages([]);
      setAdminUsers([]);
      setRoleDefinitions([]);
      setMerchantSandboxes([]);
      setSandboxPlatformSettings(null);
      setLastMerchantSandboxCreate(null);
      setSelectedInvoiceId(null);
      setSelectedInvoiceDetail(null);
      setSelectedInvoiceEvents([]);

      const onboardingStatus = await fetchOnboardingStatus(accessToken);
      setOnboarding(onboardingStatus);
      if (onboardingStatus.tenant_status === "approved") {
        const [projectItems, apiKeyItems, invoiceItems, balanceInfo, transactionItems, payoutItems, accountingSummary, ratesResponse, webhookItems, notificationSettings] =
          await Promise.all([
            fetchProjects(accessToken),
            fetchApiKeys(accessToken),
            fetchInvoices(accessToken),
            fetchBalance(accessToken),
            fetchClientTransactions(accessToken),
            fetchClientPayouts(accessToken),
            fetchClientAccountingSummary(accessToken),
            fetchRates(accessToken),
            fetchWebhookConfigs(accessToken),
            fetchClientNotificationSettings(accessToken),
          ]);
        setProjects(projectItems);
        setApiKeys(apiKeyItems);
        setInvoices(invoiceItems);
        setBalance(balanceInfo);
        setClientTransactions(transactionItems);
        setPayouts(payoutItems);
        setClientAccounting(accountingSummary);
        setRates(ratesResponse.items);
        setWebhookConfigs(webhookItems);
        setClientNotificationSettings(notificationSettings);
        if (invoiceItems.length > 0) {
          const invoiceId = selectedClientInvoiceId ?? invoiceItems[0].id;
          setSelectedClientInvoiceId(invoiceId);
          setSelectedClientInvoiceDetail(await fetchClientInvoiceDetail(accessToken, invoiceId));
        } else {
          setSelectedClientInvoiceId(null);
          setSelectedClientInvoiceDetail(null);
          setIsClientInvoiceModalOpen(false);
        }
      } else {
        setProjects([]);
        setApiKeys([]);
        setInvoices([]);
        setClientTransactions([]);
        setPayouts([]);
        setClientAccounting(null);
        setBalance(null);
        setRates([]);
        setWebhookConfigs([]);
        setClientNotificationSettings(null);
        setSelectedClientInvoiceId(null);
        setSelectedClientInvoiceDetail(null);
        setIsClientInvoiceModalOpen(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось загрузить сессию.";
      setError(message);
      clearSession();
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      const auth = await login(loginForm.email, loginForm.password);
      applyAccessToken(auth.access_token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка входа.";
      if (message === "Для входа требуется код 2FA.") {
        setLoginStep("two-factor");
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginTwoFactor(event: FormEvent<HTMLFormElement>) {
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

  function handleBackToLoginCredentials() {
    setLoginStep("credentials");
    setError(null);
    setLoginForm((current) => ({ ...current, otp_code: "" }));
  }

  function handleAuthModeChange(next: "login" | "register") {
    setMode(next);
    setLoginStep("credentials");
    setError(null);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
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
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
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
      setError(null);
      setSuccess(null);
      const result = await createAdminUser(token, payload);
      const userItems = await fetchAdminUsers(token, { scope: "platform" });
      setAdminUsers(userItems);
      if (result.invite_token) {
        setSuccess(`Пользователь создан. Invite token: ${result.invite_token}`);
      } else {
        setSuccess(`Пользователь создан: ${result.user.email}`);
      }
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
      setError(null);
      setSuccess(null);
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
      setError(null);
      setSuccess(null);
      await deleteAdminUser(token, userId);
      setAdminUsers(await fetchAdminUsers(token, { scope: "platform" }));
      setSuccess("Администратор удален.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить администратора.");
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

  async function handleSetupTwoFactor() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
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
  }

  async function handleDisableTwoFactor(payload: { password: string; code?: string }) {
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
  }

  async function handleUpdateClientNotificationSettings(payload: {
    notify_email_enabled: boolean;
    notify_telegram_enabled: boolean;
    telegram_chat_id: string | null;
  }) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const updated = await updateClientNotificationSettings(token, payload);
      setClientNotificationSettings(updated);
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
      setError(null);
      setSuccess(null);
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
      const tenantItems = await fetchTenants(token);
      setTenants(tenantItems);
      const [detail, tenantInvoices, tenantTransactions, tenantPayoutItems, tenantSummary, tenantPolicy] = await Promise.all([
        fetchTenantDetail(token, tenantId),
        fetchTenantInvoices(token, tenantId),
        fetchTenantTransactions(token, tenantId),
        fetchTenantPayouts(token, tenantId),
        fetchTenantAccountingSummary(token, tenantId),
        fetchTenantBillingPolicy(token, tenantId),
      ]);
      setSelectedTenantId(tenantId);
      setSelectedTenantDetail(detail);
      setSelectedTenantInvoices(tenantInvoices);
      setSelectedTenantTransactions(tenantTransactions);
      setSelectedTenantPayouts(tenantPayoutItems);
      setSelectedTenantAccounting(tenantSummary);
      setSelectedTenantBillingPolicy(tenantPolicy);
      if (tenantInvoices.length > 0) {
        setSelectedInvoiceId(tenantInvoices[0].id);
        setSelectedInvoiceDetail(await fetchAdminInvoiceDetail(token, tenantInvoices[0].id));
        setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, tenantInvoices[0].id), []));
      } else {
        setSelectedInvoiceId(null);
        setSelectedInvoiceDetail(null);
        setSelectedInvoiceEvents([]);
      }
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
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      await rejectTenant(token, tenantId, "Заявка отклонена супер-админом.");
      const tenantItems = await fetchTenants(token);
      setTenants(tenantItems);
      const [detail, tenantInvoices, tenantTransactions, tenantPayoutItems, tenantSummary, tenantPolicy] = await Promise.all([
        fetchTenantDetail(token, tenantId),
        fetchTenantInvoices(token, tenantId),
        fetchTenantTransactions(token, tenantId),
        fetchTenantPayouts(token, tenantId),
        fetchTenantAccountingSummary(token, tenantId),
        fetchTenantBillingPolicy(token, tenantId),
      ]);
      setSelectedTenantId(tenantId);
      setSelectedTenantDetail(detail);
      setSelectedTenantInvoices(tenantInvoices);
      setSelectedTenantTransactions(tenantTransactions);
      setSelectedTenantPayouts(tenantPayoutItems);
      setSelectedTenantAccounting(tenantSummary);
      setSelectedTenantBillingPolicy(tenantPolicy);
      if (tenantInvoices.length > 0) {
        setSelectedInvoiceId(tenantInvoices[0].id);
        setSelectedInvoiceDetail(await fetchAdminInvoiceDetail(token, tenantInvoices[0].id));
        setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, tenantInvoices[0].id), []));
      } else {
        setSelectedInvoiceId(null);
        setSelectedInvoiceDetail(null);
        setSelectedInvoiceEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить заявку.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestPasswordRecovery(email: string) {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await requestPasswordRecovery(email);
      setSuccess(result.message);
      setPasswordRecoveryEmail(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запросить восстановление пароля.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      if (passwordResetForm.password !== passwordResetForm.confirmPassword) {
        throw new Error("Подтверждение пароля не совпадает.");
      }
      const result = await setPasswordByRecoveryToken(
        passwordResetForm.token,
        passwordResetForm.password,
      );
      setSuccess(result.message);
      setMode("login");
      setLoginStep("credentials");
      setLoginForm((current) => ({
        ...current,
        email: result.email,
        password: "",
        otp_code: "",
      }));
      setPasswordResetForm({ token: "", password: "", confirmPassword: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось установить новый пароль.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAdminTenant(tenantId: string, payload: TenantAdminUpdatePayload) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
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
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
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
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      await deleteAdminTenant(token, tenantId);
      setTenants(await fetchTenants(token));
      if (selectedTenantId === tenantId) {
        setSelectedTenantId(null);
        setSelectedTenantDetail(null);
        setSelectedTenantInvoices([]);
        setSelectedTenantTransactions([]);
        setSelectedTenantPayouts([]);
        setSelectedTenantAccounting(null);
      }
      setSuccess("Мерчант удален.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить мерчанта.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminResetTenantOwnerPassword(tenantId: string) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await resetAdminTenantOwnerPassword(token, tenantId);
      setSuccess(
        `Пароль owner сброшен. Email: ${result.email}. Временный пароль: ${result.generated_password}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сбросить пароль мерчанта.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminResetTenantOwnerTwoFactor(tenantId: string) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const owner = await resetAdminTenantOwnerTwoFactor(token, tenantId);
      setSelectedTenantDetail((current) =>
        current ? { ...current, owner } : current,
      );
      setSuccess(`2FA у owner ${owner.email} сброшена.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сбросить 2FA мерчанта.");
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
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      const invoice = await createInvoice(token, {
        ...invoiceForm,
        merchant_order_id: merchantOrderId,
      });
      setSuccess(
        invoice.payment_page_url
          ? `Инвойс создан. Ссылка для клиента: ${invoice.payment_page_url}`
          : invoice.payment_address
            ? `Инвойс создан. Адрес: ${invoice.payment_address}`
            : `Инвойс создан: ${invoice.provider_order_id}`,
      );
      setSelectedClientInvoiceId(invoice.id);
      setSelectedClientInvoiceDetail({ ...invoice, settlement: null, transaction_details: null });
      setIsClientInvoiceModalOpen(true);
      setInvoices((current) => {
        const next = current.filter((item) => item.id !== invoice.id);
        return [invoice, ...next];
      });
      const [createdDetail, invoiceItems, balanceInfo, transactionItems, accountingSummary, webhookItems] =
        await Promise.all([
          fetchClientInvoiceDetail(token, invoice.id).catch(() => ({
            ...invoice,
            settlement: null,
            transaction_details: null,
          })),
          fetchInvoices(token).catch(() => null),
          fetchBalance(token),
          fetchClientTransactions(token),
          fetchClientAccountingSummary(token),
          fetchWebhookConfigs(token),
        ]);
      setSelectedClientInvoiceDetail(createdDetail);
      if (invoiceItems) {
        setInvoices(invoiceItems);
      }
      setBalance(balanceInfo);
      setClientTransactions(transactionItems);
      setClientAccounting(accountingSummary);
      setWebhookConfigs(webhookItems);
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

  async function handleRefreshBalance() {
    if (!token) {
      return;
    }
    try {
      setBalance(await fetchBalance(token));
    } catch {
      /* ignore background refresh errors */
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
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      await createClientPayout(token, payoutForm);
      const [payoutItems, balanceInfo] = await Promise.all([
        fetchClientPayouts(token),
        fetchBalance(token),
      ]);
      setPayouts(payoutItems);
      setBalance(balanceInfo);
      setSuccess("Запрос на вывод отправлен и ожидает проверки администратора.");
      setPayoutForm((current) => ({
        ...initialPayoutForm,
        project_id: current.project_id,
      }));
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
      setError(null);
      setSuccess(null);
      const result = await updateWebhookConfig(token, {
        project_id: webhookForm.project_id,
        webhook_url: webhookForm.webhook_url.trim() || undefined,
        webhook_secret: webhookForm.webhook_secret.trim() || undefined,
        return_url_success: webhookForm.return_url_success.trim() || null,
        return_url_failed: webhookForm.return_url_failed.trim() || null,
      });
      const webhookItems = await fetchWebhookConfigs(token);
      setWebhookConfigs(webhookItems);
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
  }

  async function handleInvoiceWebhookTest(invoiceId: string) {
    if (!token) {
      throw new Error("Сессия недоступна.");
    }
    return sendInvoiceWebhookTest(token, invoiceId);
  }

  function handleLogout() {
    clearSession();
    setCreatedTenant(null);
    setOnboarding(null);
    setSuccess(null);
    setNewApiSecret(null);
    setSelectedTenantId(null);
    setSelectedTenantDetail(null);
    setSelectedTenantInvoices([]);
    setSelectedTenantTransactions([]);
    setSelectedTenantPayouts([]);
    setSelectedTenantAccounting(null);
    setPlatformAccounting(null);
    setPlatformAccountingOverview(null);
    setPlatformInvoices([]);
    setPlatformTransactions([]);
    setPlatformEvents([]);
    setPlatformBillingSettings(null);
    setSelectedTenantBillingPolicy(null);
    setAdminAssetRates([]);
    setAdminUsers([]);
    setRoleDefinitions([]);
    setTwoFactorStatus(null);
    setTwoFactorSetup(null);
    setClientNotificationSettings(null);
    setSelectedInvoiceId(null);
    setSelectedInvoiceDetail(null);
    setSelectedInvoiceEvents([]);
    setSelectedClientInvoiceId(null);
    setSelectedClientInvoiceDetail(null);
    setIsClientInvoiceModalOpen(false);
    setClientTransactions([]);
    setPayouts([]);
    setClientAccounting(null);
    setRates([]);
    setWebhookConfigs([]);
    setPayoutForm(initialPayoutForm);
  }

  async function handleSelectTenant(tenantId: string) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSelectedTenantId(tenantId);
      const [
        detail,
        tenantInvoices,
        tenantTransactions,
        tenantPayoutItems,
        tenantSummary,
        allEvents,
        tenantPolicy,
      ] =
        await Promise.all([
          fetchTenantDetail(token, tenantId),
          fetchTenantInvoices(token, tenantId),
          fetchTenantTransactions(token, tenantId),
          fetchTenantPayouts(token, tenantId),
          fetchTenantAccountingSummary(token, tenantId),
          safeLoad(() => fetchAdminEvents(token), []),
          fetchTenantBillingPolicy(token, tenantId),
        ]);
      setSelectedTenantDetail(detail);
      setSelectedTenantInvoices(tenantInvoices);
      setSelectedTenantTransactions(tenantTransactions);
      setSelectedTenantPayouts(tenantPayoutItems);
      setSelectedTenantAccounting(tenantSummary);
      setSelectedTenantBillingPolicy(tenantPolicy);
      setPlatformEvents(allEvents);
      if (tenantInvoices.length > 0) {
        setSelectedInvoiceId(tenantInvoices[0].id);
        setSelectedInvoiceDetail(await fetchAdminInvoiceDetail(token, tenantInvoices[0].id));
        setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, tenantInvoices[0].id), []));
      } else {
        setSelectedInvoiceId(null);
        setSelectedInvoiceDetail(null);
        setSelectedInvoiceEvents([]);
      }
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
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      const updated = await updateAdminInvoiceStatus(token, selectedInvoiceId, status);
      setSelectedInvoiceDetail(updated);
      setSuccess(`Статус инвойса обновлён: ${invoiceStatusLabelRu(status)}.`);
      const tenantInvoices = await fetchTenantInvoices(token, selectedTenantId);
      setSelectedTenantInvoices(tenantInvoices);
      setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, selectedInvoiceId), []));
      setPlatformEvents(await safeLoad(() => fetchAdminEvents(token), []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус инвойса.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncInvoice(invoiceId: string) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const invoice = await syncAdminInvoice(token, invoiceId);
      const [invoiceItems, transactionItems, eventItems] = await Promise.all([
        fetchAdminInvoices(token),
        fetchAdminTransactions(token),
        fetchAdminEvents(token),
      ]);
      setPlatformInvoices(invoiceItems);
      setPlatformTransactions(transactionItems);
      setPlatformEvents(eventItems);
      if (selectedInvoiceId === invoiceId) {
        setSelectedInvoiceDetail(invoice);
        setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, invoiceId), []));
      }
      if (selectedTenantId) {
        const tenantInvoices = await fetchTenantInvoices(token, selectedTenantId);
        setSelectedTenantInvoices(tenantInvoices);
        setSelectedTenantTransactions(await fetchTenantTransactions(token, selectedTenantId));
      }
      setSuccess(`Статус инвойса синхронизирован: ${invoiceStatusLabelRu(invoice.status)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось синхронизировать инвойс.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRepairInvoiceSettlement(invoiceId: string) {
    if (!token) return;
    const confirmed = window.confirm(
      "Пересчитать settlement по инвойсу? Сумма в USDT и комиссии будут пересчитаны по курсу из crypto-суммы. Баланс клиента будет скорректирован.",
    );
    if (!confirmed) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const { csrf_token } = await fetchCsrfToken(token);
      applyCsrfToken(csrf_token);
      const invoice = await repairAdminInvoiceSettlement(token, invoiceId);
      const [invoiceItems, transactionItems, eventItems] = await Promise.all([
        fetchAdminInvoices(token),
        fetchAdminTransactions(token),
        safeLoad(() => fetchAdminEvents(token), []),
      ]);
      setPlatformInvoices(invoiceItems);
      setPlatformTransactions(transactionItems);
      setPlatformEvents(eventItems);
      if (selectedInvoiceId === invoiceId) {
        setSelectedInvoiceDetail(invoice);
        setSelectedInvoiceEvents(await safeLoad(() => fetchInvoiceEvents(token, invoiceId), []));
      }
      if (selectedTenantId) {
        const [tenantInvoices, tenantTransactions, tenantAccounting] = await Promise.all([
          fetchTenantInvoices(token, selectedTenantId),
          fetchTenantTransactions(token, selectedTenantId),
          safeLoad(() => fetchTenantAccountingSummary(token, selectedTenantId), null),
        ]);
        setSelectedTenantInvoices(tenantInvoices);
        setSelectedTenantTransactions(tenantTransactions);
        if (tenantAccounting) {
          setSelectedTenantAccounting(tenantAccounting);
        }
      }
      setSuccess("Settlement пересчитан: gross и комиссии приведены к USDT-эквиваленту.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось пересчитать settlement.");
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
      setIsClientInvoiceModalOpen(true);
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
      setError(null);
      setSuccess(null);
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
      setIsClientInvoiceModalOpen(true);
      setClientTransactions(transactionItems);
      setClientAccounting(accountingSummary);
      setBalance(balanceInfo);
      setSuccess(`Статус инвойса синхронизирован: ${invoiceStatusLabelRu(invoice.status)}.`);
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
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
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
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setNewApiSecret(null);
      await revokeAdminApiKey(token, apiKeyId);
      if (selectedTenantId) {
        setSelectedTenantDetail(await fetchTenantDetail(token, selectedTenantId));
      }
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
  }

  async function handleReloadPlatformSettings() {
    if (!token || !user || !isPlatformRole(user.role)) return;
    try {
      setLoading(true);
      setError(null);
      const billingSettings = await fetchPlatformBillingSettings(token);
      setPlatformBillingSettings(billingSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить настройки платформы.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshMerchantSandboxes() {
    if (!token || user?.role !== "superadmin") return;
    try {
      setLoading(true);
      setError(null);
      const [list, cfg] = await Promise.all([
        fetchMerchantSandboxes(token),
        fetchSandboxPlatformSettings(token),
      ]);
      setMerchantSandboxes(list);
      setSandboxPlatformSettings(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить данные песочниц.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMerchantSandbox(payload: MerchantSandboxCreatePayload) {
    if (!token || user?.role !== "superadmin") return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const created = await createMerchantSandbox(token, payload);
      setLastMerchantSandboxCreate(created);
      setMerchantSandboxes(await fetchMerchantSandboxes(token));
      setSandboxPlatformSettings(await fetchSandboxPlatformSettings(token));
      setSuccess("Песочница создана. Сохраните секреты из блока ниже.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать песочницу.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSandboxPlatformSettings(cloudflareApiToken: string | null | undefined) {
    if (!token || user?.role !== "superadmin") return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const next = await updateSandboxPlatformSettings(
        token,
        cloudflareApiToken === undefined ? {} : { cloudflare_api_token: cloudflareApiToken },
      );
      setSandboxPlatformSettings(next);
      setSuccess("Настройки DNS песочницы обновлены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить токен Cloudflare.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProvisionMerchantSandboxDns(sandboxId: string, ipv4: string) {
    if (!token || user?.role !== "superadmin") return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      await provisionMerchantSandboxDns(token, sandboxId, { ipv4 });
      setMerchantSandboxes(await fetchMerchantSandboxes(token));
      setSuccess("DNS и webhook для песочницы обновлены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось провижинить DNS.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDestroyMerchantSandbox(sandboxId: string) {
    if (!token || user?.role !== "superadmin") return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      await destroyMerchantSandbox(token, sandboxId);
      setMerchantSandboxes(await fetchMerchantSandboxes(token));
      setSuccess("Песочница удалена.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить песочницу.");
    } finally {
      setLoading(false);
    }
  }

  function handleDismissMerchantSandboxCreate() {
    setLastMerchantSandboxCreate(null);
  }

  async function handleFetchPlatformExchangeRate(currency: string) {
    if (!token) {
      throw new Error("Требуется авторизация.");
    }
    return await fetchPlatformExchangeRate(token, currency);
  }

  async function handleRefreshPlatformExchangeRate() {
    if (!token) {
      throw new Error("Требуется авторизация.");
    }
    return await refreshPlatformExchangeRate(token);
  }

  async function handleInspectPlatformTelegramBot(
    payload: TelegramBotInspectPayload,
  ): Promise<TelegramBotIdentity> {
    if (!token) {
      throw new Error("Требуется авторизация.");
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      return await inspectPlatformTelegramBot(token, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось проверить Telegram-бота.";
      setError(message);
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
      setError(null);
      setSuccess(null);
      const result = await sendPlatformTelegramTest(token, payload);
      setSuccess(
        `Тест Telegram отправлен в chat ${result.chat_id} (message_id: ${result.telegram_message_id ?? "-"})`,
      );
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось отправить тестовое Telegram-уведомление.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleProvisionOpsTelegramTopics(
    chatId: string | null,
  ): Promise<OpsTelegramProvisionResponse> {
    if (!token || user?.role !== "superadmin") {
      throw new Error("Доступно только superadmin.");
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await provisionOpsTelegramTopics(token, {
        chat_id: chatId?.trim() || null,
      });
      setSuccess("Топики служебного чата обновлены.");
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось создать топики служебного чата.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOpsTelegramTopicTest(
    payload: OpsTelegramTopicTestPayload,
  ): Promise<OpsTelegramTopicTestResponse> {
    if (!token || user?.role !== "superadmin") {
      throw new Error("Доступно только superadmin.");
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await sendOpsTelegramTopicTest(token, payload);
      setSuccess(`Тест ops-чата отправлен в топик ${result.topic_key}.`);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось отправить тест в топик ops-чата.";
      setError(message);
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
      setError(null);
      setSuccess(null);
      const result = await sendPlatformSmtpBzTest(token, payload);
      setSuccess(`SMTP.bz тест отправлен на ${result.recipient_email}.`);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось отправить тестовое SMTP.bz сообщение.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewNotificationTemplate(
    payload: NotificationTemplatePreviewPayload,
  ): Promise<NotificationTemplatePreview> {
    if (!token) {
      throw new Error("Нет токена администратора.");
    }
    try {
      setLoading(true);
      setError(null);
      return await previewNotificationTemplate(token, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось собрать preview шаблона.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendNotificationTemplateTest(
    payload: NotificationTemplateTestPayload,
  ): Promise<NotificationTemplateTestResponse> {
    if (!token) {
      throw new Error("Нет токена администратора.");
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await sendNotificationTemplateTest(token, payload);
      const channels = [
        result.email_sent ? "email" : null,
        result.telegram_sent ? "telegram" : null,
      ].filter(Boolean);
      setSuccess(
        channels.length
          ? `Тест шаблона отправлен: ${channels.join(", ")}.`
          : "Preview шаблона собран, но канал доставки не выбран.",
      );
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить тест шаблона.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTenantPolicy(
    payload: Omit<TenantBillingPolicy, "tenant_id">,
  ) {
    if (!token || !selectedTenantId) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const updated = await updateTenantBillingPolicy(token, selectedTenantId, payload);
      setSelectedTenantBillingPolicy(updated);
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
      setError(null);
      setSuccess(null);
      await updateAdminAssetAvailability(token, payload);
      const updatedRates = await fetchAdminAssets(token);
      setAdminAssetRates(updatedRates.items);
      setSuccess(
        `Доступ ${payload.currency}/${payload.network} ${
          payload.platform_enabled ? "включен" : "отключен"
        }.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось изменить доступность токена и сети.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleApprovePayout(payoutId: string) {
    if (!token || !selectedTenantId) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      await reviewAdminPayout(token, payoutId, {
        action: "approve",
        review_comment: "Одобрено супер-админом.",
      });
      const adminPayoutItems = await fetchAdminPayouts(token);
      setPlatformPayouts(adminPayoutItems);
      if (selectedTenantId) {
        const [tenantPayoutItems, tenantTransactions, tenantSummary] = await Promise.all([
          fetchTenantPayouts(token, selectedTenantId),
          fetchTenantTransactions(token, selectedTenantId),
          fetchTenantAccountingSummary(token, selectedTenantId),
        ]);
        setSelectedTenantPayouts(tenantPayoutItems);
        setSelectedTenantTransactions(tenantTransactions);
        setSelectedTenantAccounting(tenantSummary);
      }
      setSuccess("Запрос на вывод одобрен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось одобрить запрос на вывод.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectPayout(payoutId: string) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      await reviewAdminPayout(token, payoutId, {
        action: "reject",
        review_comment: "Отклонено супер-админом.",
      });
      const adminPayoutItems = await fetchAdminPayouts(token);
      setPlatformPayouts(adminPayoutItems);
      if (selectedTenantId) {
        const [tenantPayoutItems, tenantTransactions, tenantSummary] = await Promise.all([
          fetchTenantPayouts(token, selectedTenantId),
          fetchTenantTransactions(token, selectedTenantId),
          fetchTenantAccountingSummary(token, selectedTenantId),
        ]);
        setSelectedTenantPayouts(tenantPayoutItems);
        setSelectedTenantTransactions(tenantTransactions);
        setSelectedTenantAccounting(tenantSummary);
      }
      setSuccess("Запрос на вывод отклонен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить запрос на вывод.");
    } finally {
      setLoading(false);
    }
  }

  const {
    selectedRate,
    availableNetworks,
    selectedNetwork,
    activeApiKey,
    activeWebhook,
    apiBaseUrl,
    integrationCurl,
  } = useClientDashboard({
    rates,
    invoiceForm,
    apiKeys,
    webhookConfigs,
    webhookProjectId: webhookForm.project_id,
  });

  async function handleRecordPlatformWithdrawal(payload: PlatformEarningsWithdrawalPayload) {
    if (!token || user?.role !== "superadmin") {
      throw new Error("Доступно только superadmin.");
    }
    try {
      setLoading(true);
      setError(null);
      await recordPlatformEarningsWithdrawal(token, payload);
      const accountingOverview = await fetchPlatformAccountingOverview(token);
      setPlatformAccounting(accountingOverview.summary);
      setPlatformAccountingOverview(accountingOverview);
      setSuccess("Вывод вашей комиссии зафиксирован.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось зафиксировать вывод комиссии.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  const loadPlatformInvoices = useCallback(async () => {
    if (!token) {
      return;
    }
    const invoiceItems = await fetchAdminInvoices(token);
    setPlatformInvoices(invoiceItems);
  }, [token]);

  const loadPlatformTransactions = useCallback(async () => {
    if (!token) {
      return;
    }
    const transactionItems = await fetchAdminTransactions(token);
    setPlatformTransactions(transactionItems);
  }, [token]);

  const adminDerived = useAdminDashboard({
    tenants,
    platformEvents,
    platformAccountingOverview,
  });
  const { handleCreatePublicPage, handleUpdatePublicPage, handleDeletePublicPage } =
    useAdminPublicPagesCrud(token, {
      setLoading,
      setError,
      setSuccess,
      setAdminPublicPages,
    });

  if (adminHost && user && !isPlatformRole(user.role)) {
    return <AppRouteFallback />;
  }

return (
    <>
      <Suspense fallback={<AppRouteFallback />}>
      {!token || !user ? (
        adminHost ? (
          <AdminLoginShell
            loading={loading}
            success={success}
            error={error}
            loginForm={loginForm}
            passwordRecoveryEmail={passwordRecoveryEmail}
            passwordResetForm={passwordResetForm}
            loginStep={loginStep}
            onLoginFormChange={setLoginForm}
            onPasswordRecoveryEmailChange={setPasswordRecoveryEmail}
            onPasswordResetFormChange={setPasswordResetForm}
            onLogin={handleLogin}
            onLoginTwoFactor={handleLoginTwoFactor}
            onBackToLoginCredentials={handleBackToLoginCredentials}
            onRequestPasswordRecovery={(email) => void handleRequestPasswordRecovery(email)}
            onSetRecoveredPassword={handleSetRecoveredPassword}
          />
        ) : publicRoute.view === "docs" ? (
          <PublicDocsPageLazy
            onBackToLanding={() => openPublicPage("landing")}
            onOpenLogin={() => {
              setMode("login");
              openPublicPage("landing");
            }}
            onOpenRegister={() => {
              setMode("register");
              openPublicPage("landing");
            }}
          />
        ) : publicRoute.view === "cms" ? (
          <PublicCmsPageLazy
            loading={loading}
            page={publicPageDetail}
            onBackToLanding={() => openPublicPage("landing")}
          />
        ) : (
          <LandingPageLazy
            mode={mode}
            loginStep={loginStep}
            registrationEnabled
            loading={loading}
            success={success}
            error={error}
            loginForm={loginForm}
            passwordRecoveryEmail={passwordRecoveryEmail}
            passwordResetForm={passwordResetForm}
            registrationForm={registrationForm}
            onModeChange={handleAuthModeChange}
            onLoginFormChange={setLoginForm}
            onPasswordRecoveryEmailChange={setPasswordRecoveryEmail}
            onPasswordResetFormChange={setPasswordResetForm}
            onRegistrationFormChange={setRegistrationForm}
            onLogin={handleLogin}
            onLoginTwoFactor={handleLoginTwoFactor}
            onBackToLoginCredentials={handleBackToLoginCredentials}
            onRequestPasswordRecovery={(email) => void handleRequestPasswordRecovery(email)}
            onRegister={handleRegister}
            onSetRecoveredPassword={handleSetRecoveredPassword}
            onOpenPublicDocs={() => {
              window.location.href = resolveDocsSiteUrl();
            }}
            publicPages={publicNavigationItems}
            onOpenPublicPage={(slug) => openPublicPage("cms", slug)}
          />
        )
) : isPlatformRole(user.role) ? (
        <AdminDashboardLazy
          adminToken={token}
          user={user}
          loading={loading}
          success={success}
          error={error}
          onDismissSuccess={() => setSuccess(null)}
          onDismissError={() => setError(null)}
          newApiSecret={newApiSecret}
          tenantForm={tenantForm}
          createdTenant={createdTenant}
          tenants={tenants}
          selectedTenantId={selectedTenantId}
          selectedTenantDetail={selectedTenantDetail}
          selectedTenantInvoices={selectedTenantInvoices}
          selectedTenantTransactions={selectedTenantTransactions}
          selectedTenantPayouts={selectedTenantPayouts}
          selectedTenantAccounting={selectedTenantAccounting}
          platformAccounting={platformAccounting}
          platformAccountingOverview={platformAccountingOverview}
          platformInvoices={platformInvoices}
          platformTransactions={platformTransactions}
          platformPayouts={platformPayouts}
          platformEvents={platformEvents}
          platformBillingSettings={platformBillingSettings}
          publicPages={adminPublicPages}
          selectedTenantBillingPolicy={selectedTenantBillingPolicy}
          adminAssetRates={adminAssetRates}
          adminUsers={adminUsers}
          roleDefinitions={roleDefinitions}
          twoFactorStatus={twoFactorStatus}
          twoFactorSetup={twoFactorSetup}
          selectedInvoiceId={selectedInvoiceId}
          selectedInvoiceDetail={selectedInvoiceDetail}
          selectedInvoiceEvents={selectedInvoiceEvents}
          onLogout={handleLogout}
          onCreateTenant={handleCreateTenant}
          onTenantFormChange={setTenantForm}
          onSelectTenant={(tenantId) => void handleSelectTenant(tenantId)}
          onApproveTenant={(tenantId) => void handleApproveTenant(tenantId)}
          onRejectTenant={(tenantId) => void handleRejectTenant(tenantId)}
          onUpdateAdminTenant={(tenantId, payload) => void handleUpdateAdminTenant(tenantId, payload)}
          onUpdateAdminProject={(projectId, payload) => void handleUpdateAdminProject(projectId, payload)}
          onDeleteAdminTenant={(tenantId) => void handleDeleteAdminTenant(tenantId)}
          onResetTenantOwnerPassword={(tenantId) => void handleAdminResetTenantOwnerPassword(tenantId)}
          onResetTenantOwnerTwoFactor={(tenantId) => void handleAdminResetTenantOwnerTwoFactor(tenantId)}
          onAdminRegenerateApiKey={(apiKeyId) => void handleAdminRegenerateApiKey(apiKeyId)}
          onAdminRevokeApiKey={(apiKeyId) => void handleAdminRevokeApiKey(apiKeyId)}
          onSelectInvoice={(invoiceId) => void handleSelectInvoice(invoiceId)}
          onUpdateInvoiceStatus={(status) => void handleUpdateInvoiceStatus(status)}
          onSyncInvoice={(invoiceId) => void handleSyncInvoice(invoiceId)}
          onRepairInvoiceSettlement={(invoiceId) => void handleRepairInvoiceSettlement(invoiceId)}
          onUpdatePlatformSettings={handleUpdatePlatformSettings}
          onReloadPlatformSettings={handleReloadPlatformSettings}
          onFetchPlatformExchangeRate={handleFetchPlatformExchangeRate}
          onRefreshPlatformExchangeRate={handleRefreshPlatformExchangeRate}
          onInspectPlatformTelegramBot={(payload) => handleInspectPlatformTelegramBot(payload)}
          onSendPlatformTelegramTest={(payload) => handleSendPlatformTelegramTest(payload)}
          onProvisionOpsTelegramTopics={(chatId) => handleProvisionOpsTelegramTopics(chatId)}
          onSendOpsTelegramTopicTest={(payload) => handleSendOpsTelegramTopicTest(payload)}
          onSendPlatformSmtpBzTest={(payload) => handleSendPlatformSmtpBzTest(payload)}
          onPreviewNotificationTemplate={(payload) => handlePreviewNotificationTemplate(payload)}
          onSendNotificationTemplateTest={(payload) => handleSendNotificationTemplateTest(payload)}
          onUpdateTenantPolicy={(payload) => void handleUpdateTenantPolicy(payload)}
          onUpdateAssetAvailability={(payload) => void handleUpdateAssetAvailability(payload)}
          onCreatePublicPage={(payload) => void handleCreatePublicPage(payload)}
          onUpdatePublicPage={(pageId, payload) => void handleUpdatePublicPage(pageId, payload)}
          onDeletePublicPage={(pageId) => void handleDeletePublicPage(pageId)}
          onCreateAdminUser={(payload) => void handleCreateAdminUser(payload)}
          onUpdateAdminUser={(userId, payload) => void handleUpdateAdminUser(userId, payload)}
          onDeleteAdminUser={(userId) => void handleDeleteAdminUser(userId)}
          onSetupTwoFactor={() => void handleSetupTwoFactor()}
          onEnableTwoFactor={(code) => void handleEnableTwoFactor(code)}
          onDisableTwoFactor={(payload) => void handleDisableTwoFactor(payload)}
          onApprovePayout={(payoutId) => void handleApprovePayout(payoutId)}
          onRejectPayout={(payoutId) => void handleRejectPayout(payoutId)}
          onCloseSecretModal={() => setNewApiSecret(null)}
          sandboxConsoleEnabled={user.role === "superadmin"}
          merchantSandboxes={merchantSandboxes}
          sandboxPlatformSettings={sandboxPlatformSettings}
          lastMerchantSandboxCreate={lastMerchantSandboxCreate}
          onRefreshMerchantSandboxes={() => void handleRefreshMerchantSandboxes()}
          onCreateMerchantSandbox={(payload) => void handleCreateMerchantSandbox(payload)}
          onUpdateSandboxPlatformSettings={(t) => void handleUpdateSandboxPlatformSettings(t)}
          onProvisionMerchantSandboxDns={(id, ip) => void handleProvisionMerchantSandboxDns(id, ip)}
          onDestroyMerchantSandbox={(id) => void handleDestroyMerchantSandbox(id)}
          onDismissMerchantSandboxCreate={handleDismissMerchantSandboxCreate}
          onRecordPlatformWithdrawal={(payload) => handleRecordPlatformWithdrawal(payload)}
          onLoadPlatformInvoices={loadPlatformInvoices}
          onLoadPlatformTransactions={loadPlatformTransactions}
          {...adminDerived}
        />
      ) : onboarding?.tenant_status !== "approved" ? (
        <OnboardingScreenLazy onboarding={onboarding} onLogout={handleLogout} />
      ) : (
        <ClientDashboardLazy
          user={user}
          onboarding={onboarding}
          success={success}
          error={error}
          onDismissSuccess={() => setSuccess(null)}
          onDismissError={() => setError(null)}
          newApiSecret={newApiSecret}
          loading={loading}
          projects={projects}
          apiKeys={apiKeys}
          invoices={invoices}
          selectedClientInvoiceId={selectedClientInvoiceId}
          selectedClientInvoiceDetail={selectedClientInvoiceDetail}
          isClientInvoiceModalOpen={isClientInvoiceModalOpen}
          clientTransactions={clientTransactions}
          payouts={payouts}
          clientAccounting={clientAccounting}
          balance={balance}
          invoiceForm={invoiceForm}
          payoutForm={payoutForm}
          webhookForm={webhookForm}
          rates={rates.map((item) => ({ currency: item.currency }))}
          availableNetworks={availableNetworks}
          selectedNetwork={selectedNetwork}
          apiBaseUrl={apiBaseUrl}
          activeApiKeyPublic={activeApiKey?.public_key ?? null}
          activeWebhookUrl={activeWebhook?.webhook_url ?? null}
          selectedRoute={selectedRate ? `${selectedRate.currency} / ${selectedNetwork?.network ?? "-"}` : "Загрузка"}
          integrationCurl={integrationCurl}
          twoFactorStatus={twoFactorStatus}
          twoFactorSetup={twoFactorSetup}
          notificationSettings={clientNotificationSettings}
          onLogout={handleLogout}
          onCreateInvoice={handleCreateInvoice}
          onCreatePayout={handleCreatePayout}
          onSaveWebhook={handleSaveWebhook}
          onSendWebhookTest={handleSendWebhookTest}
          onInvoiceWebhookTest={handleInvoiceWebhookTest}
          onInvoiceFormChange={setInvoiceForm}
          onPayoutFormChange={setPayoutForm}
          onWebhookFormChange={setWebhookForm}
          onClientRegenerateApiKey={(apiKeyId) => void handleClientRegenerateApiKey(apiKeyId)}
          onClientRevokeApiKey={(apiKeyId) => void handleClientRevokeApiKey(apiKeyId)}
          onSelectClientInvoice={(invoiceId) => void handleSelectClientInvoice(invoiceId)}
          onClientInvoiceSync={(invoiceId) => void handleClientInvoiceSync(invoiceId)}
          onCloseClientInvoiceModal={() => setIsClientInvoiceModalOpen(false)}
          onSetupTwoFactor={() => void handleSetupTwoFactor()}
          onEnableTwoFactor={(code) => void handleEnableTwoFactor(code)}
          onDisableTwoFactor={(payload) => void handleDisableTwoFactor(payload)}
          onSaveNotificationSettings={(payload) => void handleUpdateClientNotificationSettings(payload)}
          onChangePassword={(payload) => void handleChangeClientPassword(payload)}
          onCloseSecretModal={() => setNewApiSecret(null)}
          onRefreshBalance={() => void handleRefreshBalance()}
        />
      )}
      </Suspense>
    </>
  );
}




