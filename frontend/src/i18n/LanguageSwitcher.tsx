import { LOCALE_OPTIONS } from "./types";
import { useTranslation } from "./LocaleProvider";

type LanguageSwitcherProps = {
  className?: string;
  variant?: "compact" | "full";
};

export function LanguageSwitcher({ className = "", variant = "compact" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <label className={`i18n-lang-switcher i18n-lang-switcher--${variant} ${className}`.trim()}>
      <span className="i18n-lang-switcher-label">{t("common.language")}</span>
      <select
        aria-label={t("common.language")}
        className="i18n-lang-select"
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        value={locale}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {variant === "full" ? `${option.nativeLabel} (${option.label})` : option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
