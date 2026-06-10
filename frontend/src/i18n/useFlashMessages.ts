import { useMemo } from "react";

import { invoiceStatusLabel } from "../utils/invoiceStatus";
import { useTranslation } from "./LocaleProvider";

export function useFlashMessages() {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      err: (fallbackKey: string, err: unknown) =>
        err instanceof Error ? err.message : t(fallbackKey),
      sessionLoadFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.sessionLoadFailed"),
      loginFailed: (err: unknown) => (err instanceof Error ? err.message : t("merchant.flash.loginFailed")),
      projectConnectFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.projectConnectFailed"),
      twoFactorSetupGenerated: () => t("merchant.flash.twoFactorSetupGenerated"),
      twoFactorSetupFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.twoFactorSetupFailed"),
      twoFactorEnabled: () => t("merchant.flash.twoFactorEnabled"),
      twoFactorEnableFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.twoFactorEnableFailed"),
      twoFactorDisabled: () => t("merchant.flash.twoFactorDisabled"),
      twoFactorDisableFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.twoFactorDisableFailed"),
      notificationsUpdated: () => t("merchant.flash.notificationsUpdated"),
      notificationsUpdateFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.notificationsUpdateFailed"),
      passwordChangeFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.passwordChangeFailed"),
      invoiceCreatedPaymentPage: (url: string) =>
        t("merchant.flash.invoiceCreatedPaymentPage", { url }),
      invoiceCreatedAddress: (address: string) =>
        t("merchant.flash.invoiceCreatedAddress", { address }),
      invoiceCreatedDefault: (id: string) => t("merchant.flash.invoiceCreatedDefault", { id }),
      invoiceCreateFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.invoiceCreateFailed"),
      payoutSelectProject: () => t("merchant.flash.payoutSelectProject"),
      payoutSubmitted: () => t("merchant.flash.payoutSubmitted"),
      payoutFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.payoutFailed"),
      webhookSaved: (projectId: string, hasSecret: boolean) =>
        t("merchant.flash.webhookSaved", {
          projectId,
          secret: hasSecret ? t("merchant.flash.webhookWithSecret") : "",
        }),
      webhookSaveFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.webhookSaveFailed"),
      webhookTestSelectProject: () => t("merchant.flash.webhookTestSelectProject"),
      webhookTestDelivered: (statusCode: number, attempts: number, eventId: string) =>
        t("merchant.flash.webhookTestDelivered", {
          statusCode: String(statusCode),
          attempts: String(attempts),
          eventId,
        }),
      webhookTestFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.webhookTestFailed"),
      invoiceStatusUpdated: (status: string) =>
        t("merchant.flash.invoiceStatusUpdated", { status: invoiceStatusLabel(status, t) }),
      invoiceStatusUpdateFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.invoiceStatusUpdateFailed"),
      invoiceSynced: (status: string) =>
        t("merchant.flash.invoiceSynced", { status: invoiceStatusLabel(status, t) }),
      invoiceSyncFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.invoiceSyncFailed"),
      invoiceDetailsLoadFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.invoiceDetailsLoadFailed"),
      apiKeyRevoked: () => t("merchant.flash.apiKeyRevoked"),
      apiKeyRevokeFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.apiKeyRevokeFailed"),
      apiKeyRegenerated: (publicKey: string) =>
        t("merchant.flash.apiKeyRegenerated", { publicKey }),
      apiKeyRegenerateFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.apiKeyRegenerateFailed"),
      passwordRecoveryFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.passwordRecoveryFailed"),
      passwordMismatch: () => t("merchant.flash.passwordMismatch"),
      passwordSetFailed: (err: unknown) =>
        err instanceof Error ? err.message : t("merchant.flash.passwordSetFailed"),
      twoFactorRequired: () => t("merchant.flash.twoFactorRequired"),
    }),
    [t],
  );
}
