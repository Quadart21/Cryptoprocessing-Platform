import { PlatformBrandMark, PlatformBrandText } from "../brand/PlatformBrandLogo";
import { usePlatformBrand } from "../brand/PlatformBrandContext";

import {
  AUTH_ADMIN_FEATURES,
  AUTH_MERCHANT_FEATURES,
  AUTH_TRUST_CHIPS,
  type AuthBrandFeature,
} from "./authBrandContent";

type LandingAuthBrandPanelProps = {
  registrationEnabled?: boolean;
  compact?: boolean;
};

function AuthFeatureIcon({ icon }: { icon: AuthBrandFeature["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    "aria-hidden": true as const,
  };

  switch (icon) {
    case "checkout":
      return (
        <svg {...common}>
          <rect height="14" rx="2" width="18" x="3" y="5" />
          <path d="M7 9h4M7 13h10" strokeLinecap="round" />
        </svg>
      );
    case "api":
      return (
        <svg {...common}>
          <path d="M8 9l-4 3 4 3V9zM16 9v6l4-3-4-3z" strokeLinejoin="round" />
          <path d="M12 5v14" strokeLinecap="round" strokeDasharray="2 3" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "rates":
      return (
        <svg {...common}>
          <path d="M4 18V6M8 18V10M12 18V14M16 18V8M20 18V4" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function LandingAuthBrandPanel({
  registrationEnabled = true,
  compact = false,
}: LandingAuthBrandPanelProps) {
  const { brandName, logoUrl } = usePlatformBrand();
  const features = registrationEnabled ? AUTH_MERCHANT_FEATURES : AUTH_ADMIN_FEATURES;

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
          <p className="lp-auth-brand-eyebrow">{brandName}</p>
          <h2 className="lp-auth-brand-title">
            <PlatformBrandText split withLogo />
          </h2>
          <p className="lp-auth-brand-tagline">
            {registrationEnabled
              ? "Крипто-эквайринг для e-commerce и SaaS: инвойсы, hosted pay и сводки в одном тенанте."
              : "Управление платформой, клиентами и настройками — в защищённой admin-консоли."}
          </p>
        </div>
      </div>

      {!compact ? (
        <ul className="lp-auth-feature-list">
          {features.map((feature) => (
            <li className="lp-auth-feature-item" key={feature.id}>
              <span className="lp-auth-feature-icon">
                <AuthFeatureIcon icon={feature.icon} />
              </span>
              <span>
                <strong>{feature.title}</strong>
                <small>{feature.description}</small>
              </span>
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

      {!compact ? (
        <div className="lp-auth-brand-footer">
          <span>Merchant</span>
          <span className="lp-auth-brand-footer-dot" aria-hidden />
          <span>Platform API</span>
          <span className="lp-auth-brand-footer-dot" aria-hidden />
          <span>Webhooks</span>
        </div>
      ) : null}
    </div>
  );
}
