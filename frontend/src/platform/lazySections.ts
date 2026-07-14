import { lazy } from "react";

export const AdminOverviewSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminOverviewSection");
  return { default: m.AdminOverviewSection };
});

export const AdminAccountingSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminAccountingSection");
  return { default: m.AdminAccountingSection };
});

export const AdminClientsSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminClientsSection");
  return { default: m.AdminClientsSection };
});

export const AdminPartnersSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminPartnersSection");
  return { default: m.AdminPartnersSection };
});

export const AdminClientDetailSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminClientDetailSection");
  return { default: m.AdminClientDetailSection };
});

export const AdminPlatformSettingsSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminPlatformSettingsSection");
  return { default: m.AdminPlatformSettingsSection };
});

export const AdminPublicPagesSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminPublicPagesSection");
  return { default: m.AdminPublicPagesSection };
});

export const AdminUsersPanelLazy = lazy(async () => {
  const m = await import("./sections/AdminUsersPanel");
  return { default: m.AdminUsersPanel };
});

export const AdminPlatformPayoutsPanelLazy = lazy(async () => {
  const m = await import("./sections/AdminPlatformPayoutsPanel");
  return { default: m.AdminPlatformPayoutsPanel };
});

export const AssetManagementPageLazy = lazy(async () => {
  const m = await import("./sections/AssetManagementPage");
  return { default: m.AssetManagementPage };
});

export const AdminBackupsSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminBackupsSection");
  return { default: m.AdminBackupsSection };
});

export const PlatformInvoicesPanelLazy = lazy(async () => {
  const m = await import("./sections/AdminPlatformPanels");
  return { default: m.PlatformInvoicesPanel };
});

export const PlatformTransactionsPanelLazy = lazy(async () => {
  const m = await import("./sections/AdminPlatformPanels");
  return { default: m.PlatformTransactionsPanel };
});

export const AdminPlatformApiUsageSectionLazy = lazy(async () => {
  const m = await import("./sections/AdminPlatformApiUsageSection");
  return { default: m.AdminPlatformApiUsageSection };
});

export const PlatformEventsPanelLazy = lazy(async () => {
  const m = await import("./sections/AdminPlatformPanels");
  return { default: m.PlatformEventsPanel };
});
