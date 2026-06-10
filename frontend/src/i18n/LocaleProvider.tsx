import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getLocale, setLocale as persistLocale } from "../storage";
import { LOCALES } from "./locales";
import { getTranslationArray, resolveTranslation } from "./resolve";
import { DEFAULT_LOCALE, LOCALE_OPTIONS, type Locale, type TranslationDict } from "./types";

type TParams = Record<string, string | number>;

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (next: Locale) => void;
  t: (key: string, params?: TParams) => string;
  ta: <T>(key: string) => T[];
  dict: TranslationDict;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectInitialLocale(): Locale {
  const stored = getLocale();
  if (stored) {
    return stored;
  }

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("ar")) {
    return "ar";
  }
  if (browserLang.startsWith("en")) {
    return "en";
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const dir = useMemo(
    () => LOCALE_OPTIONS.find((item) => item.code === locale)?.dir ?? "ltr",
    [locale],
  );

  const dict = LOCALES[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback(
    (key: string, params?: TParams) => resolveTranslation(dict, key, params),
    [dict],
  );

  const ta = useCallback(<T,>(key: string) => getTranslationArray<T>(dict, key), [dict]);

  const value = useMemo(
    () => ({ locale, dir, setLocale, t, ta, dict }),
    [locale, dir, setLocale, t, ta, dict],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}

export function useTranslation() {
  const { t, ta, locale, dir, setLocale } = useLocale();
  return { t, ta, locale, dir, setLocale };
}
