import type { Locale } from "../../i18n/types";
import type { DocsArticle, DocsArticleKey } from "./types";
import { docsArticlesAr } from "./ar";
import { docsArticlesEn } from "./en";
import { docsArticlesRu } from "./ru";

const BY_LOCALE: Record<Locale, Record<DocsArticleKey, DocsArticle>> = {
  ru: docsArticlesRu,
  en: docsArticlesEn,
  ar: docsArticlesAr,
};

export function getDocsArticle(locale: Locale, key: DocsArticleKey): DocsArticle {
  return BY_LOCALE[locale][key] ?? docsArticlesRu[key];
}

export type { DocsArticleKey };
