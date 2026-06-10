export type Locale = "ru" | "en" | "ar";

export type LocaleOption = {
  code: Locale;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
};

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: "ru", label: "Russian", nativeLabel: "Русский", dir: "ltr" },
  { code: "en", label: "English", nativeLabel: "English", dir: "ltr" },
  { code: "ar", label: "Arabic (UAE)", nativeLabel: "العربية", dir: "rtl" },
];

export const DEFAULT_LOCALE: Locale = "ru";

export type TranslationValue = string | TranslationDict | TranslationValue[];

export type TranslationDict = {
  [key: string]: TranslationValue;
};
