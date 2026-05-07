import { useMemo } from "react";



import type { PublicPageNavigationItem } from "../api";



import {

  LANDING_FEATURE_CARDS,

  LANDING_FLOW_STEPS,

  LANDING_FAQ,

  LANDING_HERO_STATS_CARD,

  LANDING_PLATFORM_POINTS,

  LANDING_TOKEN_STRIP,

  LANDING_TRUST_PILLARS,

} from "./content";



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



function FeatureIcon({ name }: { name: (typeof LANDING_FEATURE_CARDS)[number]["icon"] }) {

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



  return (

    <>

      <header className="lpx-header">

        <div className="lpx-header-glow" aria-hidden />

        <div className="lpx-container lpx-header-inner">

          <a className="lpx-logo" href="#">

            <div className="lpx-logo-mark">

              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>

                <path

                  d="M12 2L2 7L12 12L22 7L12 2Z"

                  stroke="currentColor"

                  strokeWidth="2"

                  strokeLinecap="round"

                  strokeLinejoin="round"

                />

                <path

                  d="M2 17L12 22L22 17"

                  stroke="currentColor"

                  strokeWidth="2"

                  strokeLinecap="round"

                  strokeLinejoin="round"

                />

                <path

                  d="M2 12L12 17L22 12"

                  stroke="currentColor"

                  strokeWidth="2"

                  strokeLinecap="round"

                  strokeLinejoin="round"

                />

              </svg>

            </div>

            <div className="lpx-logo-text">

              <span className="lpx-logo-title">Noren</span>

              <span className="lpx-logo-sub">Digital Acquiring</span>

            </div>

          </a>



          <nav className="lpx-nav" aria-label="Разделы лендинга">

            {headerPages.map((item) => (

              <button key={`header-${item.slug}`} type="button" onClick={() => onOpenPublicPage(item.slug)}>

                {item.title}

              </button>

            ))}

            <button type="button" onClick={onOpenPublicDocs}>

              API

            </button>

          </nav>



          <div className="lpx-header-actions">

            <button className="nc-btn-ghost lpx-btn-min" type="button" onClick={() => openAuth("login")}>

              Войти

            </button>

            <button className="nc-btn-primary lpx-btn-min" type="button" onClick={() => openAuth("register")}>

              Подключить

            </button>

          </div>



          <button

            type="button"

            className={`lpx-burger ${mobileMenuOpen ? "lpx-burger--open" : ""}`}

            aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}

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

            aria-label="Мобильное меню"

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

              API

            </button>

            <button

              type="button"

              className="lpx-mobile-sheet-cta"

              onClick={() => {

                openAuth("login");

              }}

            >

              Войти

            </button>

            <button

              type="button"

              className="lpx-mobile-sheet-cta lpx-mobile-sheet-cta--primary"

              onClick={() => {

                openAuth("register");

              }}

            >

              Подключить

            </button>

          </nav>

        </div>

      ) : null}



      <section className="lpx-hero" aria-labelledby="lpx-hero-heading">

        <div className="lpx-hero-visual-bg" aria-hidden>

          <div className="lpx-hero-orbit" />

          <div className="lpx-hero-grid" />

        </div>



        <div className="lpx-container lpx-hero-layout">

          <div className="lpx-hero-copy">

            <p className="lpx-eyebrow">

              <span className="lpx-eyebrow-dot" aria-hidden />

              Крипто-эквайринг для e-commerce

            </p>

            <h1 id="lpx-hero-heading" className="lpx-hero-title">

              Платежи в криптовалюте

              <span className="lpx-hero-title-break"> </span>

              <span className="lpx-hero-title-accent">на уровне премиум-сервиса</span>

            </h1>

            <p className="lpx-hero-lead">

              Встраиваем приём цифровых активов в ваш бренд: прозрачные статусы, API и вебхуки, сопровождение до

              боевого запуска — без ощущения «техно-стартапа без поддержки».

            </p>

            <div className="lpx-hero-actions">

              <button className="nc-btn-primary nc-btn-lg lpx-hero-primary" type="button" onClick={() => openAuth("register")}>

                Обсудить подключение

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

              <button className="nc-btn-ghost nc-btn-lg" type="button" onClick={onOpenPublicDocs}>

                Документация

              </button>

            </div>

            <div className="lpx-token-row" aria-label="Поддерживаемые сети и активы (кратко)">

              {LANDING_TOKEN_STRIP.map((token) => (

                <span key={token} className="lpx-token-chip">

                  {token}

                </span>

              ))}

            </div>

          </div>



          <aside className="lpx-hero-panel" aria-label="Ключевые параметры интеграции">

            <div className="lpx-glass-card">

              <div className="lpx-glass-card-header">

                <span className="lpx-glass-pill">Live-ready</span>

                <span className="lpx-glass-meta">Merchant console · API keys</span>

              </div>

              <div className="lpx-glass-metrics">

                {LANDING_HERO_STATS_CARD.map((row) => (

                  <div key={row.label} className="lpx-glass-metric">

                    <span className="lpx-glass-metric-value">{row.value}</span>

                    <span className="lpx-glass-metric-label">{row.label}</span>

                  </div>

                ))}

              </div>

              <pre className="lpx-code-snippet">

                <code>{`POST /v1/invoices

{

  "amount_fiat": "120.00",

  "fiat_currency": "EUR"

}`}</code>

              </pre>

              <p className="lpx-glass-foot">

                Оформление инвойса и отслеживание статуса — в едином контуре с вашим бэкендом.

              </p>

            </div>

          </aside>

        </div>

      </section>



      <section className="lpx-trust" aria-label="Преимущества доверия">

        <div className="lpx-container lpx-trust-grid">

          {LANDING_TRUST_PILLARS.map((pillar) => (

            <div key={pillar.title} className="lpx-trust-item">

              <h2 className="lpx-trust-title">{pillar.title}</h2>

              <p className="lpx-trust-sub">{pillar.subtitle}</p>

            </div>

          ))}

        </div>

      </section>



      <section className="lpx-section" aria-labelledby="lpx-bento-heading">

        <div className="lpx-container">

          <header className="lpx-section-head">

            <p className="lpx-kicker">Платформа</p>

            <div className="lpx-section-head-row">

              <h2 id="lpx-bento-heading" className="lpx-section-title">

                Архитектура, которую не стыдно показать инвестору

              </h2>

              <p className="lpx-section-deck">

                Каждое преимущество — это не маркетинговый лозунг, а конкретная возможность API и кабинета для

                контроля оборота.

              </p>

            </div>

          </header>

          <div className="lpx-bento">

            {LANDING_FEATURE_CARDS.map((feature) => (

              <article

                key={feature.title}

                className={`lpx-bento-card lpx-bento-card--${feature.bento}`}

              >

                <div className="lpx-bento-icon" aria-hidden>

                  <FeatureIcon name={feature.icon} />

                </div>

                <h3 className="lpx-bento-title">{feature.title}</h3>

                <p className="lpx-bento-desc">{feature.description}</p>

              </article>

            ))}

          </div>

        </div>

      </section>



      <section className="lpx-section lpx-section--alt" aria-labelledby="lpx-platform-heading">

        <div className="lpx-container lpx-split">

          <div className="lpx-split-text">

            <p className="lpx-kicker">Инструментарий</p>

            <h2 id="lpx-platform-heading" className="lpx-section-title">

              Всё, что нужно для учёта и автоматизации

            </h2>

            <p className="lpx-split-lead">

              Единая модель данных для инвойсов и транзакций: ваш продукт получает предсказуемые колбэки и согласованную

              семантику статусов.

            </p>

          </div>

          <ul className="lpx-check-list">

            {LANDING_PLATFORM_POINTS.map((point) => (

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

            <p className="lpx-kicker">Процесс</p>

            <h2 id="lpx-steps-heading" className="lpx-section-title">

              От заявки до приёма платежей

            </h2>

            <p className="lpx-section-deck lpx-section-deck--narrow">

              Чёткая последовательность без хаоса в переписке: вы всегда знаете, какой шаг следующий.

            </p>

          </header>

          <ol className="lpx-timeline">

            {LANDING_FLOW_STEPS.map((step, index) => (

              <li key={step.number} className="lpx-timeline-item">

                <div className="lpx-timeline-axis" aria-hidden>

                  <span className="lpx-timeline-node">{step.number}</span>

                  {index < LANDING_FLOW_STEPS.length - 1 ? <span className="lpx-timeline-line" /> : null}

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

            <p className="lpx-kicker">FAQ</p>

            <h2 id="lpx-faq-heading" className="lpx-section-title">

              Ответы до созвона с отделом подключения

            </h2>

          </header>

          <div className="lpx-faq">

            {LANDING_FAQ.map((item, index) => (

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

                Готовы вывести оплату на новый уровень?

              </h2>

              <p className="lpx-cta-text">Оставьте заявку — подготовим сценарий интеграции под ваш стек и регион.</p>

            </div>

            <div className="lpx-cta-actions">

              <button className="nc-btn-primary nc-btn-lg" type="button" onClick={() => openAuth("register")}>

                Запросить подключение

              </button>

              <button className="nc-btn-ghost nc-btn-lg" type="button" onClick={onOpenPublicDocs}>

                Смотреть API

              </button>

            </div>

          </div>

        </div>

      </section>



      <footer className="lpx-footer">

        <div className="lpx-container lpx-footer-grid">

          <div className="lpx-footer-brand-block">

            <div className="lpx-logo-mark lpx-logo-mark--footer">

              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>

                <path

                  d="M12 2L2 7L12 12L22 7L12 2Z"

                  stroke="currentColor"

                  strokeWidth="2"

                  strokeLinecap="round"

                  strokeLinejoin="round"

                />

                <path

                  d="M2 17L12 22L22 17"

                  stroke="currentColor"

                  strokeWidth="2"

                  strokeLinecap="round"

                  strokeLinejoin="round"

                />

                <path

                  d="M2 12L12 17L22 12"

                  stroke="currentColor"

                  strokeWidth="2"

                  strokeLinecap="round"

                  strokeLinejoin="round"

                />

              </svg>

            </div>

            <p className="lpx-footer-tagline">Noren Digital — криптопроцессинг для команд, которым важен контроль.</p>

            <p className="lpx-footer-copy">© {new Date().getFullYear()} Noren Digital</p>

          </div>

          <div className="lpx-footer-col">

            <h3 className="lpx-footer-heading">Навигация</h3>

            <div className="lpx-footer-links">

              {footerPages.map((item) => (

                <button key={`footer-${item.slug}`} type="button" onClick={() => onOpenPublicPage(item.slug)}>

                  {item.title}

                </button>

              ))}

              <button type="button" onClick={onOpenPublicDocs}>

                API

              </button>

            </div>

          </div>

          <div className="lpx-footer-col">

            <h3 className="lpx-footer-heading">Кабинет</h3>

            <div className="lpx-footer-links">

              <button type="button" onClick={() => openAuth("login")}>

                Вход для мерчантов

              </button>

              <button type="button" onClick={() => openAuth("register")}>

                Регистрация

              </button>

            </div>

          </div>

        </div>

      </footer>

    </>

  );

}

