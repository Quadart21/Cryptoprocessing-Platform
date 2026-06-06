import { PlatformBrandMark, PlatformBrandText } from "../brand/PlatformBrandLogo";
import { usePlatformBrand } from "../brand/PlatformBrandContext";

import {
  AUTH_ADMIN_HIGHLIGHTS,
  AUTH_MERCHANT_HIGHLIGHTS,
  AUTH_TRUST_CHIPS,
} from "./authBrandContent";

type LandingAuthBrandPanelProps = {
  registrationEnabled?: boolean;
  compact?: boolean;
};

export function LandingAuthBrandPanel({
  registrationEnabled = true,
  compact = false,
}: LandingAuthBrandPanelProps) {
  const { logoUrl } = usePlatformBrand();
  const highlights = registrationEnabled ? AUTH_MERCHANT_HIGHLIGHTS : AUTH_ADMIN_HIGHLIGHTS;

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
              {registrationEnabled
                ? "Крипто-эквайринг для e-commerce и SaaS: инвойсы, hosted pay и сводки в одном тенанте."
                : "Управление платформой, клиентами и настройками — в защищённой admin-консоли."}
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

      <div className="lp-auth-chip-row" aria-label="Поддерживаемые возможности">
        {AUTH_TRUST_CHIPS.map((chip) => (
          <span className="lp-auth-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
