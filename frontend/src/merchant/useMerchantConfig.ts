import { useMemo } from "react";

import type { DashboardRailGroup } from "../components/layout/DashboardRail";
import { useTranslation } from "../i18n";
import type { MerchantSection } from "./types";

export function useMerchantMenuGroups(): DashboardRailGroup[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
      {
        key: "overview-group",
        label: t("merchant.menu.overviewGroup"),
        items: [
          { key: "overview", label: t("merchant.menu.overview") },
          { key: "transactions", label: t("merchant.menu.transactions") },
          { key: "balance", label: t("merchant.menu.balance") },
        ],
      },
      {
        key: "integration-group",
        label: t("merchant.menu.integrationGroup"),
        items: [
          { key: "docs", label: t("merchant.menu.docs") },
          { key: "projects", label: t("merchant.menu.projects") },
          { key: "keys", label: t("merchant.menu.keys") },
          { key: "invoices", label: t("merchant.menu.invoices") },
        ],
      },
      {
        key: "security-group",
        label: t("merchant.menu.securityGroup"),
        items: [{ key: "security", label: t("merchant.menu.security") }],
      },
    ],
    [t],
  );
}

export function useMerchantSectionCopy(): Record<
  MerchantSection,
  { group: string; title: string; description: string }
> {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      overview: {
        group: t("merchant.sections.overview.group"),
        title: t("merchant.sections.overview.title"),
        description: t("merchant.sections.overview.description"),
      },
      transactions: {
        group: t("merchant.sections.transactions.group"),
        title: t("merchant.sections.transactions.title"),
        description: t("merchant.sections.transactions.description"),
      },
      balance: {
        group: t("merchant.sections.balance.group"),
        title: t("merchant.sections.balance.title"),
        description: t("merchant.sections.balance.description"),
      },
      docs: {
        group: t("merchant.sections.docs.group"),
        title: t("merchant.sections.docs.title"),
        description: t("merchant.sections.docs.description"),
      },
      projects: {
        group: t("merchant.sections.projects.group"),
        title: t("merchant.sections.projects.title"),
        description: t("merchant.sections.projects.description"),
      },
      keys: {
        group: t("merchant.sections.keys.group"),
        title: t("merchant.sections.keys.title"),
        description: t("merchant.sections.keys.description"),
      },
      invoices: {
        group: t("merchant.sections.invoices.group"),
        title: t("merchant.sections.invoices.title"),
        description: t("merchant.sections.invoices.description"),
      },
      security: {
        group: t("merchant.sections.security.group"),
        title: t("merchant.sections.security.title"),
        description: t("merchant.sections.security.description"),
      },
    }),
    [t],
  );
}

export function useMerchantShortcuts(): Array<{ section: MerchantSection; label: string; hint: string }> {
  const { ta } = useTranslation();

  return useMemo(
    () =>
      ta<{ section: MerchantSection; label: string; hint: string }>("merchant.shortcuts"),
    [ta],
  );
}

export function useIsMerchantSection(menuGroups: DashboardRailGroup[]) {
  return useMemo(() => {
    const keys = new Set(menuGroups.flatMap((group) => group.items.map((item) => item.key)));
    return (value: string): value is MerchantSection => keys.has(value);
  }, [menuGroups]);
}
