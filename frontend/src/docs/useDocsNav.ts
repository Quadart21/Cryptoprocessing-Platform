import { useMemo } from "react";

import { useTranslation } from "../i18n";
import type { DocsSectionKey } from "../types/docsSection";
import {
  DOCS_API_ENDPOINT_KEYS,
  DOCS_HUB_CARD_KEYS,
  DOCS_HUB_CARD_ROUTES,
  DOCS_PIPELINE_KEYS,
  DOCS_SIDEBAR_STRUCTURE,
} from "./docsNav";

export type DocsPageMeta = {
  eyebrow: string;
  title: string;
  lead: string;
};

export function useDocsPageMeta(): Record<DocsSectionKey, DocsPageMeta> {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      quickstart: {
        eyebrow: t("docsSite.pages.quickstart.eyebrow"),
        title: t("docsSite.pages.quickstart.title"),
        lead: t("docsSite.pages.quickstart.lead"),
      },
      checkout: {
        eyebrow: t("docsSite.pages.checkout.eyebrow"),
        title: t("docsSite.pages.checkout.title"),
        lead: t("docsSite.pages.checkout.lead"),
      },
      webhooks: {
        eyebrow: t("docsSite.pages.webhooks.eyebrow"),
        title: t("docsSite.pages.webhooks.title"),
        lead: t("docsSite.pages.webhooks.lead"),
      },
      integrations: {
        eyebrow: t("docsSite.pages.integrations.eyebrow"),
        title: t("docsSite.pages.integrations.title"),
        lead: t("docsSite.pages.integrations.lead"),
      },
      commissions: {
        eyebrow: t("docsSite.pages.commissions.eyebrow"),
        title: t("docsSite.pages.commissions.title"),
        lead: t("docsSite.pages.commissions.lead"),
      },
      reference: {
        eyebrow: t("docsSite.pages.reference.eyebrow"),
        title: t("docsSite.pages.reference.title"),
        lead: t("docsSite.pages.reference.lead"),
      },
      faq: {
        eyebrow: t("docsSite.pages.faq.eyebrow"),
        title: t("docsSite.pages.faq.title"),
        lead: t("docsSite.pages.faq.lead"),
      },
    }),
    [t],
  );
}

export function useDocsSidebarGroups() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      DOCS_SIDEBAR_STRUCTURE.map((group) => ({
        label: t(`docsSite.sidebar.groups.${group.groupKey}`),
        items: group.items.map((item) => ({
          to: item.to,
          icon: item.icon,
          label: t(`docsSite.sidebar.items.${item.key}.label`),
          description: t(`docsSite.sidebar.items.${item.key}.description`),
        })),
      })),
    [t],
  );
}

export function useDocsPipeline() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      DOCS_PIPELINE_KEYS.map((key, index) => ({
        step: String(index + 1).padStart(2, "0"),
        title: t(`docsSite.pipeline.${key}.title`),
        text: t(`docsSite.pipeline.${key}.text`),
      })),
    [t],
  );
}

export function useDocsHubCards() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      DOCS_HUB_CARD_KEYS.map((key, index) => ({
        to: DOCS_HUB_CARD_ROUTES[key],
        title: t(`docsSite.hub.cards.${key}.title`),
        body: t(`docsSite.hub.cards.${key}.body`),
        icon: String(index + 1).padStart(2, "0"),
      })),
    [t],
  );
}

export function useDocsApiEndpoints() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      DOCS_API_ENDPOINT_KEYS.map((item) => ({
        href: item.href,
        method: item.method,
        label: t(`docsSite.endpoints.${item.key}`),
      })),
    [t],
  );
}
