import { PlatformBrandMark, PlatformBrandText } from "../brand/PlatformBrandLogo";
import { usePlatformBrand } from "../brand/PlatformBrandContext";
import { useTranslation } from "../i18n";
import { AUTH_TRUST_CHIPS } from "./authBrandContent";

type LandingAuthBrandPanelProps = {
  registrationEnabled?: boolean;
  compact?: boolean;
};

export function LandingAuthBrandPanel({
  registrationEnabled = true,
  compact = false,
}: LandingAuthBrandPanelProps) {
  const { logoUrl } = usePlatformBrand();
  const { t, ta } = useTranslation();
  const highlights = registrationEnabled
    ? ta<string>("auth.merchantHighlights")
    : ta<string>("auth.adminHighlights");

  return (
    <div className={`lp-auth-brand-panel${compact ? " lp-auth-brand-panel--compact" : ""}`}>
      <div className="lp-auth-brand-hero">
        {logoUrl ? (
          <PlatformBrandMark imgClassName="lp-auth-brand-logo-img lp-auth-brand-logo-img--hero" />
        ) : (
          <div className="lp-auth-brand-mark">
            <PlatformBrandMark />
          </div>
        )}
        <div className="lp-auth-brand-hero-text">
          <h2 className="lp-auth-brand-title">
            <PlatformBrandText split withLogo />
          </h2>
          {!compact ? (
            <p className="lp-auth-brand-tagline">
              {registrationEnabled ? t("auth.merchantTagline") : t("auth.adminTagline")}
            </p>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <ul className="lp-auth-highlights">
          {highlights.map((line) => (
            <li className="lp-auth-highlight" key={line}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="lp-auth-chip-row" aria-label={t("auth.capabilitiesAria")}>
        {AUTH_TRUST_CHIPS.map((chip) => (
          <span className="lp-auth-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
