import { useMemo } from "react";

import type { PublicPageNavigationItem } from "../api";
import {
  PlatformBrandMark,
  PlatformBrandText,
  usePlatformBrand,
} from "../brand/PlatformBrandLogo";
import { LanguageSwitcher, useTranslation } from "../i18n";
import { LANDING_TOKEN_STRIP } from "./content";

type LandingFeatureCard = {
  icon: "zap" | "globe" | "shield" | "dollar";
  title: string;
  description: string;
  bento: "wide" | "normal";
};



export type LandingSiteChromeProps = {

  publicPages: PublicPageNavigationItem[];

  onOpenPublicDocs: () => void;

  onOpenPublicPage: (slug: string) => void;

  openAuth: (next: "login" | "register") => void;

  mobileMenuOpen: boolean;

  setMobileMenuOpen: (open: boolean) => void;

  openFaqIndex: number | null;

  setOpenFaqIndex: (index: number | null) => void;

};



function FeatureIcon({ name }: { name: LandingFeatureCard["icon"] }) {

  if (name === "zap") {

    return (

      <svg aria-hidden viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

        <path

          d="M13 2L3 14H12L11 22L21 10H12L13 2Z"

          stroke="currentColor"

          strokeWidth="2"

          strokeLinecap="round"

          strokeLinejoin="round"

        />

      </svg>

    );

  }

  if (name === "globe") {

    return (

      <svg aria-hidden viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />

        <path d="M2 12H22" stroke="currentColor" strokeWidth="2" />

        <path

          d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z"

          stroke="currentColor"

          strokeWidth="2"

        />

      </svg>

    );

  }

  if (name === "shield") {

    return (

      <svg aria-hidden viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

        <path

          d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"

          stroke="currentColor"

          strokeWidth="2"

          strokeLinecap="round"

          strokeLinejoin="round"

        />

      </svg>

    );

  }

  return (

    <svg aria-hidden viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

      <path d="M12 1V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      <path

        d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6"

        stroke="currentColor"

        strokeWidth="2"

        strokeLinecap="round"

        strokeLinejoin="round"

      />

    </svg>

  );

}



export function LandingSiteChrome({

  publicPages,

  onOpenPublicDocs,

  onOpenPublicPage,

  openAuth,

  mobileMenuOpen,

  setMobileMenuOpen,

  openFaqIndex,

  setOpenFaqIndex,

}: LandingSiteChromeProps) {
  const { t, ta } = useTranslation();

  const featureCards = ta<LandingFeatureCard>("landing.features");
  const featureShowcase = featureCards.slice(0, 3);
  const flowSteps = ta<{ number: string; title: string; description: string }>("landing.flowSteps");
  const faq = ta<{ question: string; answer: string }>("landing.faq");
  const trustPillars = ta<{ title: string; subtitle: string }>("landing.trustPillars");
  const platformPoints = ta<string>("landing.platformPoints");
  const heroStats = ta<{ value: string; label: string }>("landing.heroStats");

  const headerPages = useMemo(

    () =>

      [...publicPages]

        .filter((item) => item.show_in_header)

        .sort((a, b) => a.header_order - b.header_order),

    [publicPages],

  );

  const footerPages = useMemo(

    () =>

      [...publicPages]

        .filter((item) => item.show_in_footer)

        .sort((a, b) => a.footer_order - b.footer_order),

    [publicPages],

  );

  const { brandName, logoUrl } = usePlatformBrand();



  return (

    <>

      <header className="lpx-header">

        <div className="lpx-header-glow" aria-hidden />

        <div className="lpx-container lpx-header-inner">

          <a className="lpx-logo" href="#">

            {logoUrl ? (
              <PlatformBrandMark imgClassName="lpx-logo-custom-img" />
            ) : (
              <div className="lpx-logo-mark">
                <PlatformBrandMark />
              </div>
            )}

            <div className="lpx-logo-text">

              <PlatformBrandText split withLogo className="lpx-logo-title" />

              {!logoUrl ? (
                <span className="lpx-logo-sub">{t("landing.logoSub")}</span>
              ) : null}

            </div>

          </a>



          <nav className="lpx-nav" aria-label={t("landing.navAria")}>

            {headerPages.map((item) => (

              <button key={`header-${item.slug}`} type="button" onClick={() => onOpenPublicPage(item.slug)}>

                {item.title}

              </button>

            ))}

            <button type="button" onClick={onOpenPublicDocs}>
              {t("common.api")}
            </button>

          </nav>



          <div className="lpx-header-actions">
            <LanguageSwitcher variant="compact" />
            <button className="nc-btn-ghost lpx-btn-min" type="button" onClick={() => openAuth("login")}>
              {t("common.login")}
            </button>
            <button className="nc-btn-primary lpx-btn-min lpx-header-cta" type="button" onClick={() => openAuth("register")}>
              {t("landing.start")}
            </button>
          </div>



          <button

            type="button"

            className={`lpx-burger ${mobileMenuOpen ? "lpx-burger--open" : ""}`}

            aria-label={mobileMenuOpen ? t("landing.closeMenu") : t("landing.openMenu")}

            aria-expanded={mobileMenuOpen}

            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}

          >

            <span />

            <span />

            <span />

          </button>

        </div>

      </header>



      {mobileMenuOpen ? (

        <div className="lpx-mobile-overlay" onClick={() => setMobileMenuOpen(false)} role="presentation">

          <nav

            className="lpx-mobile-sheet"

            aria-label={t("landing.mobileMenuAria")}

            onClick={(e) => e.stopPropagation()}

          >

            {headerPages.map((item) => (

              <button

                key={`mobile-${item.slug}`}

                type="button"

                onClick={() => {

                  onOpenPublicPage(item.slug);

                  setMobileMenuOpen(false);

                }}

              >

                {item.title}

              </button>

            ))}

            <button

              type="button"

              onClick={() => {

                onOpenPublicDocs();

                setMobileMenuOpen(false);

              }}

            >

              {t("common.api")}
            </button>
            <LanguageSwitcher variant="full" />
            <button
              type="button"
              className="lpx-mobile-sheet-cta"
              onClick={() => {
                openAuth("login");
              }}
            >
              {t("common.login")}
            </button>
            <button
              type="button"
              className="lpx-mobile-sheet-cta lpx-mobile-sheet-cta--primary"
              onClick={() => {
                openAuth("register");
              }}
            >
              {t("landing.connect")}
            </button>
          </nav>

        </div>

      ) : null}



      <section className="lpx-hero" aria-labelledby="lpx-hero-heading">

        <div className="lpx-hero-visual-bg" aria-hidden>

          <div className="lpx-hero-grid-fine" />

          <div className="lpx-hero-glow-arc" />

        </div>

        <div className="lpx-container lpx-hero-layout">

          <div className="lpx-hero-copy">

            <p className="lpx-hero-kicker">{t("landing.heroKicker")}</p>
            <h1 id="lpx-hero-heading" className="lpx-hero-title">
              {t("landing.heroTitlePrefix")}{" "}
              <span className="lpx-hero-title-lime">{t("landing.heroTitleAccent")}</span>{" "}
              {t("landing.heroTitleSuffix")}
              <span className="lpx-hero-title-dot">.</span>
            </h1>
            <p className="lpx-hero-lead">{t("landing.heroLead")}</p>
            <div className="lpx-hero-social" aria-label={t("landing.heroSocialAria")}>

              <div className="lpx-hero-avatars" aria-hidden>

                {[0, 1, 2, 3, 4].map((i) => (

                  <span key={i} className={`lpx-hero-avatar lpx-hero-avatar--${i}`} />

                ))}

              </div>

              <span
                className="lpx-hero-social-text"
                dangerouslySetInnerHTML={{ __html: t("landing.heroSocialText") }}
              />

            </div>

            <div className="lpx-hero-actions">

              <button className="nc-btn-primary nc-btn-lg lpx-hero-primary" type="button" onClick={() => openAuth("register")}>
                {t("landing.heroConnect")}
              </button>
              <button className="nc-btn-ghost nc-btn-lg lpx-hero-outline" type="button" onClick={onOpenPublicDocs}>
                {t("landing.heroDocs")}
              </button>

            </div>

            <div className="lpx-hero-micro">

              <span className="lpx-hero-arrow-btn" aria-hidden>

                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

                  <path

                    d="M7 17L17 7M17 7H9M17 7V15"

                    stroke="currentColor"

                    strokeWidth="2"

                    strokeLinecap="round"

                    strokeLinejoin="round"

                  />

                </svg>

              </span>

              <p className="lpx-hero-micro-text">{t("landing.heroMicro")}</p>

            </div>

            <div className="lpx-token-row" aria-label={t("landing.tokensAria")}>

              {LANDING_TOKEN_STRIP.map((token) => (

                <span key={token} className="lpx-token-chip">

                  {token}

                </span>

              ))}

            </div>

          </div>

          <aside className="lpx-hero-panel" aria-label={t("landing.panelAria")}>

            <div className="lpx-phone-stage">

              <div className="lpx-phone lpx-phone--back" aria-hidden>

                <div className="lpx-phone-notch" />

                <div className="lpx-phone-body">

                  <div className="lpx-phone-chart">

                    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>

                      <path

                        d="M10 95 L45 70 L80 82 L115 45 L150 55 L190 25"

                        stroke="var(--lp-lime)"

                        strokeWidth="3"

                        strokeLinecap="round"

                        strokeLinejoin="round"

                      />

                      <circle cx="115" cy="45" r="5" fill="var(--lp-lime)" />

                    </svg>

                  </div>

                  <div className="lpx-phone-metrics">

                    {heroStats.map((row) => (

                      <div key={row.label} className="lpx-phone-metric">

                        <span>{row.value}</span>

                        <small>{row.label}</small>

                      </div>

                    ))}

                  </div>

                </div>

              </div>

              <div className="lpx-phone lpx-phone--front" aria-hidden>

                <div className="lpx-phone-notch" />

                <div className="lpx-phone-body">

                  <span className="lpx-phone-badge">Live</span>

                  <pre className="lpx-phone-code">

                    <code>{`POST /v1/invoices

{

  "amount_fiat": "120",

  "fiat_currency": "EUR"

}`}</code>

                  </pre>

                  <button type="button" className="lpx-phone-cta" tabIndex={-1}>

                    {t("landing.createInvoice")}
                  </button>

                </div>

              </div>

            </div>

          </aside>

        </div>

      </section>



      <section className="lpx-trust-strip" aria-label={t("landing.trustStripAria")}>
        <div className="lpx-container lpx-trust-strip-inner">
          {trustPillars.map((pillar) => (

            <div key={pillar.title} className="lpx-trust-strip-item">

              <h2 className="lpx-trust-strip-title">{pillar.title}</h2>

              <p className="lpx-trust-strip-sub">{pillar.subtitle}</p>

            </div>

          ))}

        </div>

      </section>



      <section className="lpx-section" aria-labelledby="lpx-bento-heading">

        <div className="lpx-container">

          <header className="lpx-section-head">

            <p className="lpx-kicker">{t("landing.platformKicker")}</p>
            <div className="lpx-section-head-row">
              <h2 id="lpx-bento-heading" className="lpx-section-title">
                {t("landing.platformTitlePrefix")}{" "}
                <span className="lpx-section-title-accent">{t("landing.platformTitleAccent")}</span>
              </h2>
              <p className="lpx-section-deck">{t("landing.platformDeck")}</p>

            </div>

          </header>

          <div className="lpx-bento lpx-bento--three">

            {featureShowcase.map((feature, index) => (

              <article

                key={feature.title}

                className={`lpx-bento-card lpx-bento-card--${feature.bento} ${index === 1 ? "lpx-bento-card--accent" : ""}`}

              >

                <span className="lpx-bento-num">{String(index + 1).padStart(2, "0")}.</span>

                <div className="lpx-bento-icon" aria-hidden>

                  <FeatureIcon name={feature.icon} />

                </div>

                <h3 className="lpx-bento-title">{feature.title}</h3>

                <p className="lpx-bento-desc">{feature.description}</p>

                {index === 1 ? (

                  <button type="button" className="lpx-bento-more" onClick={() => openAuth("register")}>

                    {t("landing.learnMore")}
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>

                      <path

                        d="M5 12H19M19 12L12 5M19 12L12 19"

                        stroke="currentColor"

                        strokeWidth="2"

                        strokeLinecap="round"

                        strokeLinejoin="round"

                      />

                    </svg>

                  </button>

                ) : null}

              </article>

            ))}

          </div>

          {featureCards[3] ? (
            <article className="lpx-bento-wide">
              <div className="lpx-bento-icon" aria-hidden>
                <FeatureIcon name={featureCards[3].icon} />
              </div>
              <div>
                <span className="lpx-bento-num">04.</span>
                <h3 className="lpx-bento-title">{featureCards[3].title}</h3>
                <p className="lpx-bento-desc">{featureCards[3].description}</p>

              </div>

            </article>

          ) : null}

        </div>

      </section>



      <section className="lpx-proof" aria-labelledby="lpx-proof-heading">

        <div className="lpx-container lpx-proof-grid">

          <div className="lpx-proof-chart" aria-hidden>

            <div className="lpx-proof-chart-float lpx-proof-chart-float--a">

              <span>$4,528</span>

              <small>USDT</small>

            </div>

            <div className="lpx-proof-chart-float lpx-proof-chart-float--b">

              <span>1.44 BTC</span>

              <small>{t("landing.proofVolume")}</small>

            </div>

            <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">

              <defs>

                <linearGradient id="lpxChartGrad" x1="0" y1="0" x2="0" y2="1">

                  <stop offset="0%" stopColor="var(--lp-lime)" stopOpacity="0.35" />

                  <stop offset="100%" stopColor="var(--lp-lime)" stopOpacity="0" />

                </linearGradient>

              </defs>

              <path

                d="M0 160 Q80 140 120 100 T200 80 T320 40 L320 200 L0 200 Z"

                fill="url(#lpxChartGrad)"

              />

              <path

                d="M0 155 Q90 130 140 95 T260 70 L320 45"

                stroke="var(--lp-lime)"

                strokeWidth="3"

                fill="none"

                strokeLinecap="round"

              />

              <circle cx="200" cy="80" r="6" fill="var(--lp-lime)" />

              <circle cx="260" cy="70" r="6" fill="var(--lp-lime)" />

            </svg>

          </div>

          <div className="lpx-proof-copy">

            <h2 id="lpx-proof-heading" className="lpx-proof-title">
              {t("landing.proofTitlePrefix")}{" "}
              <span className="lpx-proof-title-lime">{t("landing.proofTitleAccent")}</span>{" "}
              {t("landing.proofTitleSuffix")}
            </h2>
            <div className="lpx-proof-stars" aria-label={t("landing.proofRatingAria")}>

              {[1, 2, 3, 4].map((s) => (

                <span key={s} className="lpx-proof-star lpx-proof-star--on">

                  ★

                </span>

              ))}

              <span className="lpx-proof-star">★</span>

            </div>

            <p className="lpx-proof-lead">{t("landing.proofLead")}</p>
            <p className="lpx-proof-text">{t("landing.proofText")}</p>
            <div className="lpx-proof-actions">
              <button type="button" className="nc-btn-primary nc-btn-lg" onClick={() => openAuth("register")}>
                {t("landing.heroConnect")}
              </button>
              <button type="button" className="lpx-proof-link" onClick={() => openAuth("login")}>
                {t("landing.askQuestion")}
              </button>

            </div>

          </div>

        </div>

      </section>



      <section className="lpx-section lpx-section--alt" aria-labelledby="lpx-platform-heading">

        <div className="lpx-container lpx-split">

          <div className="lpx-split-text">

            <p className="lpx-kicker">{t("landing.toolkitKicker")}</p>
            <h2 id="lpx-platform-heading" className="lpx-section-title">
              {t("landing.toolkitTitle")}
            </h2>
            <p className="lpx-split-lead">{t("landing.toolkitLead")}</p>

          </div>

          <ul className="lpx-check-list">

            {platformPoints.map((point) => (

              <li key={point}>

                <span className="lpx-check-mark" aria-hidden>

                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

                    <path

                      d="M5 13L10 18L19 7"

                      stroke="currentColor"

                      strokeWidth="2"

                      strokeLinecap="round"

                      strokeLinejoin="round"

                    />

                  </svg>

                </span>

                <span>{point}</span>

              </li>

            ))}

          </ul>

        </div>

      </section>



      <section className="lpx-section" aria-labelledby="lpx-steps-heading">

        <div className="lpx-container">

          <header className="lpx-section-head lpx-section-head--center">

            <p className="lpx-kicker">{t("landing.processKicker")}</p>
            <h2 id="lpx-steps-heading" className="lpx-section-title">
              {t("landing.processTitle")}
            </h2>
            <p className="lpx-section-deck lpx-section-deck--narrow">{t("landing.processDeck")}</p>

          </header>

          <ol className="lpx-timeline">

            {flowSteps.map((step, index) => (

              <li key={step.number} className="lpx-timeline-item">

                <div className="lpx-timeline-axis" aria-hidden>

                  <span className="lpx-timeline-node">{step.number}</span>

                  {index < flowSteps.length - 1 ? <span className="lpx-timeline-line" /> : null}

                </div>

                <div className="lpx-timeline-body">

                  <h3 className="lpx-timeline-title">{step.title}</h3>

                  <p className="lpx-timeline-desc">{step.description}</p>

                </div>

              </li>

            ))}

          </ol>

        </div>

      </section>



      <section className="lpx-section lpx-section--faq" aria-labelledby="lpx-faq-heading">

        <div className="lpx-container">

          <header className="lpx-section-head lpx-section-head--center">

            <p className="lpx-kicker">{t("landing.faqKicker")}</p>
            <h2 id="lpx-faq-heading" className="lpx-section-title">
              {t("landing.faqTitle")}
            </h2>

          </header>

          <div className="lpx-faq">

            {faq.map((item, index) => (

              <div

                key={item.question}

                className={`lpx-faq-item ${openFaqIndex === index ? "lpx-faq-item--open" : ""}`}

              >

                <button

                  type="button"

                  className="lpx-faq-q"

                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}

                  aria-expanded={openFaqIndex === index}

                >

                  <span>{item.question}</span>

                  <svg aria-hidden viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

                    <path

                      d="M6 9L12 15L18 9"

                      stroke="currentColor"

                      strokeWidth="2"

                      strokeLinecap="round"

                      strokeLinejoin="round"

                    />

                  </svg>

                </button>

                <div className="lpx-faq-a">

                  <p>{item.answer}</p>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>



      <section className="lpx-cta" aria-labelledby="lpx-cta-heading">

        <div className="lpx-container">

          <div className="lpx-cta-inner">

            <div className="lpx-cta-copy">

              <h2 id="lpx-cta-heading" className="lpx-cta-title">
                {t("landing.ctaTitle")}
              </h2>
              <p className="lpx-cta-text">{t("landing.ctaText")}</p>

            </div>

            <div className="lpx-cta-actions">

              <button className="nc-btn-primary nc-btn-lg" type="button" onClick={() => openAuth("register")}>
                {t("landing.ctaRequest")}
              </button>
              <button className="nc-btn-ghost nc-btn-lg" type="button" onClick={onOpenPublicDocs}>
                {t("landing.ctaApi")}
              </button>

            </div>

          </div>

        </div>

      </section>



      <footer className="lpx-footer">

        <div className="lpx-container lpx-footer-grid">

          <div className="lpx-footer-brand-block">

            <div className="lpx-footer-brand-row">

              {logoUrl ? (
                <PlatformBrandMark imgClassName="lpx-logo-custom-img lpx-logo-custom-img--footer" />
              ) : (
                <div className="lpx-logo-mark lpx-logo-mark--footer">
                  <PlatformBrandMark />
                </div>
              )}

              <PlatformBrandText split withLogo className="lpx-logo-title lpx-logo-title--footer" />

            </div>

            <p className="lpx-footer-tagline">
              {t("landing.footerTagline", { brand: brandName })}
            </p>

            <p className="lpx-footer-copy">© {new Date().getFullYear()} {brandName}</p>

          </div>

          <div className="lpx-footer-col">

            <h3 className="lpx-footer-heading">{t("landing.footerNav")}</h3>

            <div className="lpx-footer-links">

              {footerPages.map((item) => (

                <button key={`footer-${item.slug}`} type="button" onClick={() => onOpenPublicPage(item.slug)}>

                  {item.title}

                </button>

              ))}

              <button type="button" onClick={onOpenPublicDocs}>
                {t("common.api")}
              </button>
            </div>
          </div>
          <div className="lpx-footer-col">
            <h3 className="lpx-footer-heading">{t("landing.footerCabinet")}</h3>
            <div className="lpx-footer-links">
              <button type="button" onClick={() => openAuth("login")}>
                {t("landing.footerMerchantLogin")}
              </button>
              <button type="button" onClick={() => openAuth("register")}>
                {t("landing.footerRegister")}
              </button>

            </div>

          </div>

        </div>

      </footer>

    </>

  );

}

