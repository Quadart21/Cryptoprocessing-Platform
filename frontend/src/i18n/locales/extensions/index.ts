import type { TranslationDict, TranslationValue } from "../../types";

import { merchantExt as merchantExtAr } from "./merchantExt.ar";
import { merchantExt as merchantExtEn } from "./merchantExt.en";
import { merchantExt as merchantExtRu } from "./merchantExt.ru";

function deepMerge(base: TranslationDict, ext: TranslationDict): TranslationDict {
  const result: TranslationDict = { ...base };

  for (const key of Object.keys(ext)) {
    const baseVal = result[key];
    const extVal = ext[key];

    if (
      typeof baseVal === "object" &&
      baseVal !== null &&
      !Array.isArray(baseVal) &&
      typeof extVal === "object" &&
      extVal !== null &&
      !Array.isArray(extVal)
    ) {
      result[key] = deepMerge(baseVal as TranslationDict, extVal as TranslationDict);
    } else {
      result[key] = extVal as TranslationValue;
    }
  }

  return result;
}

export const MERCHANT_EXTENSIONS: Record<"ru" | "en" | "ar", TranslationDict> = {
  ru: merchantExtRu,
  en: merchantExtEn,
  ar: merchantExtAr,
};

export function mergeMerchantExtension(base: TranslationDict, locale: "ru" | "en" | "ar"): TranslationDict {
  return deepMerge(base, MERCHANT_EXTENSIONS[locale]);
}

export { merchantExtAr, merchantExtEn, merchantExtRu };
