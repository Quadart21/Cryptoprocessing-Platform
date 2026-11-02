import { LOCALES } from "../i18n/locales";
import { resolveTranslation } from "../i18n/resolve";
import type { Locale } from "../i18n/types";
import type { PublicSurface } from "./requestContext";

const DOC_SECTIONS = new Set([
  "quickstart",
  "checkout",
  "webhooks",
  "integrations",
  "commissions",
  "reference",
  "faq",
]);

export function publicHead(
  locale: Locale,
  surface: PublicSurface,
  url: string,
): { title: string; description: string } {
  const t = (key: string) => resolveTranslation(LOCALES[locale], key);
  if (surface === "landing") {
    return {
      title: [t("landing.heroTitlePrefix"), t("landing.heroTitleAccent"), t("landing.heroTitleSuffix")]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      description: t("landing.heroLead"),
    };
  }

  const parts = url.split("?")[0].split("/").filter(Boolean);
  if (parts.length === 0) {
    return {
      title: `${t("docsSite.hub.titleLine1")} ${t("docsSite.hub.titleLine2")}`.replace(/\s+/g, " ").trim(),
      description: t("docsSite.hub.lead"),
    };
  }
  if (parts[0] === "integrations" && parts[1]) {
    return {
      title: t(`merchant.apiDocs.integrations.modules.${parts[1]}.title`),
      description: t(`merchant.apiDocs.integrations.modules.${parts[1]}.body`),
    };
  }
  if (DOC_SECTIONS.has(parts[0])) {
    return {
      title: t(`docsSite.pages.${parts[0]}.title`),
      description: t(`docsSite.pages.${parts[0]}.lead`),
    };
  }
  return {
    title: t("docsSite.hub.titleLine1"),
    description: t("docsSite.hub.lead"),
  };
}
