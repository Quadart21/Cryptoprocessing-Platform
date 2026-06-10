import { ar } from "./ar";
import { en } from "./en";
import { mergeMerchantExtension } from "./extensions";
import { ru } from "./ru";

import type { Locale, TranslationDict } from "../types";

export const LOCALES: Record<Locale, TranslationDict> = {
  ru: mergeMerchantExtension(ru, "ru"),
  en: mergeMerchantExtension(en, "en"),
  ar: mergeMerchantExtension(ar, "ar"),
};
