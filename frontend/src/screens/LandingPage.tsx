import { FormEvent, useEffect, useMemo, useState } from "react";

import type { PublicPageNavigationItem, RegistrationPayload } from "../api";

type LoginFormState = {
  email: string;
  password: string;
  otp_code: string;
};

type LandingPageProps = {
  mode: "login" | "register";
  loginStep: "credentials" | "two-factor";
  registrationEnabled?: boolean;
  loading: boolean;
  success: string | null;
  error: string | null;
  loginForm: LoginFormState;
  passwordRecoveryEmail: string;
  passwordResetForm: {
    token: string;
    password: string;
    confirmPassword: string;
  };
  registrationForm: RegistrationPayload;
  publicPages: PublicPageNavigationItem[];
  onOpenPublicDocs: () => void;
  onOpenPublicPage: (slug: string) => void;
  onModeChange: (mode: "login" | "register") => void;
  onLoginFormChange: (next: LoginFormState) => void;
  onPasswordRecoveryEmailChange: (next: string) => void;
  onPasswordResetFormChange: (next: {
    token: string;
    password: string;
    confirmPassword: string;
  }) => void;
  onRegistrationFormChange: (next: RegistrationPayload) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onLoginTwoFactor: (event: FormEvent<HTMLFormElement>) => void;
  onBackToLoginCredentials: () => void;
  onRequestPasswordRecovery: (email: string) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
  onSetRecoveredPassword: (event: FormEvent<HTMLFormElement>) => void;
};

const FEATURES = [
  {
    icon: "zap",
    title: "Подключение за 1 день",
    description: "Готовый виджет и API. Интеграция с CMS без технических сложностей.",
  },
  {
    icon: "globe",
    title: "Глобальный охват",
    description: "Принимайте платежи от клиентов из любой точки мира без ограничений.",
  },
  {
    icon: "shield",
    title: "Без блокировок",
    description: "Никаких отказов банков и заморозок счетов. Крипта не знает границ.",
  },
  {
    icon: "dollar",
    title: "Прозрачные комиссии",
    description: "Одна ставка. Без скрытых платежей за вывод или конвертацию.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Заявка",
    description: "Оставьте заявку на подключение",
  },
  {
    number: "02",
    title: "Интеграция",
    description: "Подключаем API или виджет за 1 день",
  },
  {
    number: "03",
    title: "Тестирование",
    description: "Проверяем работу в тестовом режиме",
  },
  {
    number: "04",
    title: "Запуск",
    description: "Начинаете принимать платежи",
  },
];

const FAQ_ITEMS = [
  {
    question: "Какие монеты принимаете?",
    answer: "BTC, ETH, USDT (TRC-20, ERC-20) и другие основные сети. Список расширяется.",
  },
  {
    question: "Как быстро приходят деньги?",
    answer: "Выплаты по расписанию или по запросу, в зависимости от тарифа.",
  },
  {
    question: "Нужно ли юрлицо?",
    answer: "Работаем с юридическими лицами и ИП. Детали уточняются при подключении.",
  },
  {
    question: "Есть ли тестовый режим?",
    answer: "Да. Можно проверить интеграцию до запуска в продакшн.",
  },
];

const TOKENS = ["BTC", "ETH", "USDT", "TRON", "BNB", "SOL"];

export function LandingPage({
  mode,
  loginStep,
  registrationEnabled = true,
  loading,
  success,
  error,
  loginForm,
  passwordRecoveryEmail,
  passwordResetForm,
  registrationForm,
  publicPages,
  onOpenPublicDocs,
  onOpenPublicPage,
  onModeChange,
  onLoginFormChange,
  onPasswordRecoveryEmailChange,
  onPasswordResetFormChange,
  onRegistrationFormChange,
  onLogin,
  onLoginTwoFactor,
  onBackToLoginCredentials,
  onRequestPasswordRecovery,
  onRegister,
  onSetRecoveredPassword,
}: LandingPageProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [recoveryMode, setRecoveryMode] = useState<"login" | "request" | "reset">("login");

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

  useEffect(() => {
    if (success || error) {
      setAuthOpen(true);
    }
  }, [success, error]);

  useEffect(() => {
    if (loginStep === "two-factor") {
      setAuthOpen(true);
    }
  }, [loginStep]);

  useEffect(() => {
    if (!authOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAuthOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [authOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (authOpen || mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [authOpen, mobileMenuOpen]);

  const openAuth = (next: "login" | "register") => {
    onModeChange(next);
    setRecoveryMode("login");
    setMobileMenuOpen(false);
    setAuthOpen(true);
  };

  return (
    <main className="nc-landing">
      <header className="nc-header">
        <div className="nc-header-inner">
          <a className="nc-logo" href="#">
            <div className="nc-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="nc-logo-text">
              <strong>NOREN</strong>
              <span>Digital</span>
            </div>
          </a>

          <nav className="nc-nav">
            {headerPages.map((item) => (
              <button
                key={`header-${item.slug}`}
                onClick={() => onOpenPublicPage(item.slug)}
                type="button"
              >
                {item.title}
              </button>
            ))}
            <button onClick={onOpenPublicDocs} type="button">API</button>
          </nav>

          <div className="nc-header-actions">
            <button className="nc-btn-ghost" onClick={() => openAuth("login")} type="button">
              Войти
            </button>
            <button className="nc-btn-primary" onClick={() => openAuth("register")} type="button">
              Подключить
            </button>
          </div>

          <button
            className={`nc-burger ${mobileMenuOpen ? "nc-burger-active" : ""}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="nc-mobile-menu" onClick={() => setMobileMenuOpen(false)}>
          <nav className="nc-mobile-menu-inner" onClick={(e) => e.stopPropagation()}>
            {headerPages.map((item) => (
              <button
                key={`mobile-${item.slug}`}
                onClick={() => {
                  onOpenPublicPage(item.slug);
                  setMobileMenuOpen(false);
                }}
                type="button"
              >
                {item.title}
              </button>
            ))}
            <button onClick={() => { onOpenPublicDocs(); setMobileMenuOpen(false); }} type="button">API</button>
            <button onClick={() => { openAuth("login"); }} type="button">Войти</button>
            <button onClick={() => { openAuth("register"); }} type="button">Подключить</button>
          </nav>
        </div>
      )}

      <section className="nc-hero">
        <div className="nc-hero-bg">
          <div className="nc-hero-gradient"></div>
          <div className="nc-hero-grid"></div>
        </div>
        
        <div className="nc-hero-content">
          <div className="nc-hero-badge">
            <span className="nc-hero-badge-dot"></span>
            Crypto acquiring for ecommerce
          </div>
          
          <h1>
            Принимайте криптовалюту
            <br />
            <span className="nc-hero-accent">без ограничений</span>
          </h1>
          
          <p className="nc-hero-lead">
            Подключаем крипто-эквайринг к вашему магазину за 1 день.
            Без блокировок, без банковских отказов, без потерянных клиентов.
          </p>

          <div className="nc-hero-cta">
            <button className="nc-btn-primary nc-btn-lg" onClick={() => openAuth("register")} type="button">
              Подключить процессинг
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="nc-btn-ghost nc-btn-lg" onClick={onOpenPublicDocs} type="button">
              Документация API
            </button>
          </div>

          <div className="nc-hero-tokens">
            {TOKENS.map((token) => (
              <span key={token}>{token}</span>
            ))}
          </div>
        </div>

        <div className="nc-hero-stats">
          <div className="nc-hero-stat">
            <span className="nc-hero-stat-value">1 день</span>
            <span className="nc-hero-stat-label">Подключение</span>
          </div>
          <div className="nc-hero-stat">
            <span className="nc-hero-stat-value">24/7</span>
            <span className="nc-hero-stat-label">Поддержка</span>
          </div>
          <div className="nc-hero-stat">
            <span className="nc-hero-stat-value">0%</span>
            <span className="nc-hero-stat-label">Блокировок</span>
          </div>
        </div>
      </section>

      <section className="nc-section nc-features">
        <div className="nc-section-header">
          <span className="nc-section-label">Преимущества</span>
          <h2>Почему выбирают Noren</h2>
        </div>
        
        <div className="nc-features-grid">
          {FEATURES.map((feature) => (
            <div className="nc-feature-card" key={feature.title}>
              <div className="nc-feature-icon">
                {feature.icon === "zap" && (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {feature.icon === "globe" && (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M2 12H22" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
                {feature.icon === "shield" && (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {feature.icon === "dollar" && (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="nc-section nc-how">
        <div className="nc-section-header">
          <span className="nc-section-label">Как это работает</span>
          <h2>Простое подключение за 4 шага</h2>
        </div>

        <div className="nc-steps">
          {STEPS.map((step, index) => (
            <div className="nc-step" key={step.number}>
              <span className="nc-step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {index < STEPS.length - 1 && <div className="nc-step-line"></div>}
            </div>
          ))}
        </div>
      </section>

      <section className="nc-section nc-faq">
        <div className="nc-section-header">
          <span className="nc-section-label">FAQ</span>
          <h2>Частые вопросы</h2>
        </div>

        <div className="nc-faq-list">
          {FAQ_ITEMS.map((item, index) => (
            <div className={`nc-faq-item ${openFaqIndex === index ? "nc-faq-open" : ""}`} key={item.question}>
              <button className="nc-faq-question" onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)} type="button">
                <span>{item.question}</span>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="nc-faq-answer">
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="nc-cta">
        <div className="nc-cta-content">
          <h2>Готовы принимать криптовалюту?</h2>
          <p>Оставьте заявку — подключим ваш магазин за 1 день</p>
          <div className="nc-cta-actions">
            <button className="nc-btn-primary nc-btn-lg" onClick={() => openAuth("register")} type="button">
              Оставить заявку
            </button>
          </div>
        </div>
      </section>

      <footer className="nc-footer">
        <div className="nc-footer-inner">
          <div className="nc-footer-brand">
            <div className="nc-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span>© 2026 Noren Digital</span>
          </div>
          
          <div className="nc-footer-links">
            {footerPages.map((item) => (
              <button key={`footer-${item.slug}`} onClick={() => onOpenPublicPage(item.slug)} type="button">
                {item.title}
              </button>
            ))}
            <button onClick={onOpenPublicDocs} type="button">API</button>
            <button onClick={() => openAuth("login")} type="button">Личный кабинет</button>
          </div>
        </div>
      </footer>

      {authOpen && (
        <div className="nc-modal-overlay" onClick={() => setAuthOpen(false)}>
          <div className="nc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="nc-modal-close" onClick={() => setAuthOpen(false)} type="button">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="nc-modal-tabs">
              <button
                className={mode === "login" ? "nc-modal-tab-active" : ""}
                onClick={() => onModeChange("login")}
                type="button"
              >
                Вход
              </button>
              <button
                className={mode === "register" ? "nc-modal-tab-active" : ""}
                onClick={() => onModeChange("register")}
                disabled={!registrationEnabled}
                type="button"
              >
                Регистрация
              </button>
            </div>

            {mode === "login" || !registrationEnabled ? (
              recoveryMode === "login" && loginStep === "credentials" ? (
                <form className="nc-form" onSubmit={onLogin}>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={loginForm.email}
                      onChange={(e) => onLoginFormChange({ ...loginForm, email: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Пароль</span>
                    <input
                      type="password"
                      placeholder="Введите пароль"
                      value={loginForm.password}
                      onChange={(e) => onLoginFormChange({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "..." : "Далее"}
                  </button>
                  <button
                    className="nc-btn-ghost"
                    onClick={() => setRecoveryMode("request")}
                    type="button"
                  >
                    Забыли пароль?
                  </button>
                </form>
              ) : recoveryMode === "login" && loginStep === "two-factor" ? (
                <form className="nc-form" onSubmit={onLoginTwoFactor}>
                  <div className="result-box">
                    <p>{loginForm.email}</p>
                    <p>Введите код из приложения-аутентификатора.</p>
                  </div>
                  <label>
                    <span>2FA код</span>
                    <input
                      type="text"
                      value={loginForm.otp_code}
                      onChange={(e) => onLoginFormChange({ ...loginForm, otp_code: e.target.value })}
                      inputMode="numeric"
                      maxLength={8}
                      autoFocus
                      required
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "..." : "Подтвердить вход"}
                  </button>
                  <button
                    className="nc-btn-ghost"
                    onClick={onBackToLoginCredentials}
                    type="button"
                  >
                    Назад
                  </button>
                </form>
              ) : recoveryMode === "request" ? (
                <form
                  className="nc-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onRequestPasswordRecovery(passwordRecoveryEmail);
                  }}
                >
                  <label>
                    <span>Email мерчанта</span>
                    <input
                      type="email"
                      value={passwordRecoveryEmail}
                      onChange={(e) => onPasswordRecoveryEmailChange(e.target.value)}
                      required
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "..." : "Отправить токен"}
                  </button>
                  <button
                    className="nc-btn-ghost"
                    onClick={() => setRecoveryMode("reset")}
                    type="button"
                  >
                    У меня уже есть токен
                  </button>
                  <button
                    className="nc-btn-ghost"
                    onClick={() => setRecoveryMode("login")}
                    type="button"
                  >
                    Назад ко входу
                  </button>
                </form>
              ) : (
                <form className="nc-form" onSubmit={onSetRecoveredPassword}>
                  <label>
                    <span>Токен восстановления</span>
                    <input
                      value={passwordResetForm.token}
                      onChange={(e) =>
                        onPasswordResetFormChange({
                          ...passwordResetForm,
                          token: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Новый пароль</span>
                    <input
                      type="password"
                      value={passwordResetForm.password}
                      onChange={(e) =>
                        onPasswordResetFormChange({
                          ...passwordResetForm,
                          password: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Повторите пароль</span>
                    <input
                      type="password"
                      value={passwordResetForm.confirmPassword}
                      onChange={(e) =>
                        onPasswordResetFormChange({
                          ...passwordResetForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "..." : "Установить новый пароль"}
                  </button>
                  <button
                    className="nc-btn-ghost"
                    onClick={() => setRecoveryMode("request")}
                    type="button"
                  >
                    Запросить новый токен
                  </button>
                  <button
                    className="nc-btn-ghost"
                    onClick={() => setRecoveryMode("login")}
                    type="button"
                  >
                    Назад ко входу
                  </button>
                </form>
              )
            ) : (
              <form className="nc-form" onSubmit={onRegister}>
                <div className="nc-form-grid">
                  <label>
                    <span>Компания</span>
                    <input
                      value={registrationForm.company_name}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, company_name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Владелец</span>
                    <input
                      value={registrationForm.owner_full_name}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, owner_full_name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={registrationForm.owner_email}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, owner_email: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Пароль</span>
                    <input
                      type="password"
                      value={registrationForm.password}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, password: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Домен</span>
                    <input
                      value={registrationForm.domain}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, domain: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Описание проекта</span>
                    <input
                      value={registrationForm.project_description}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, project_description: e.target.value })}
                    />
                  </label>
                </div>
                <button className="nc-btn-primary" disabled={loading} type="submit">
                  {loading ? "..." : "Подключить"}
                </button>
              </form>
            )}

            {success && <p className="nc-success">{success}</p>}
            {error && <p className="nc-error">{error}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
