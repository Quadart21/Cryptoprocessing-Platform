import { FormEvent, useEffect, useMemo, useState } from "react";

import type { PublicPageNavigationItem, RegistrationPayload } from "../api";

type LoginFormState = {
  email: string;
  password: string;
  otp_code: string;
};

type LandingPageProps = {
  mode: "login" | "register";
  registrationEnabled?: boolean;
  loading: boolean;
  success: string | null;
  error: string | null;
  loginForm: LoginFormState;
  registrationForm: RegistrationPayload;
  publicPages: PublicPageNavigationItem[];
  onOpenPublicDocs: () => void;
  onOpenPublicPage: (slug: string) => void;
  onModeChange: (mode: "login" | "register") => void;
  onLoginFormChange: (next: LoginFormState) => void;
  onRegistrationFormChange: (next: RegistrationPayload) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
};

const HERO_NUMBERS = [
  { label: "Запуск", value: "1 день" },
  { label: "Поддержка", value: "24/7" },
  { label: "Сети", value: "TRC20 / ERC20 / BTC" },
];

const BENEFITS = [
  {
    title: "Быстрое подключение",
    description:
      "Готовый виджет и API. Интеграция с популярными CMS за один рабочий день. Ваша команда тратит минимум времени.",
  },
  {
    title: "Глобальный охват",
    description:
      "Ваши клиенты из России, Беларуси, Казахстана, Украины и любой другой точки мира платят без ограничений. Крипта не знает границ.",
  },
  {
    title: "Стабильные выплаты",
    description:
      "Принимаете USDT и получаете USDT. Без конвертации по невыгодному курсу, без сюрпризов на счёте.",
  },
  {
    title: "Прозрачная комиссия",
    description:
      "Одна ставка. Без скрытых платежей за вывод, конвертацию или обслуживание. Вы всегда знаете, сколько зарабатываете.",
  },
  {
    title: "Личный кабинет",
    description:
      "Все транзакции, статусы и аналитика в одном месте. Экспорт для бухгалтерии в один клик.",
  },
];

const AUDIENCE = [
  "Интернет-магазин, которому отказал банк или платёжная система",
  "Бизнес с клиентами из разных стран СНГ и не только",
  "Магазин, который хочет принимать крипту, но не знает с чего начать",
  "Команда, которой нужно надёжное решение без технической боли",
];

const FAQ_ITEMS = [
  {
    question: "Какие монеты принимаете?",
    answer: "BTC, ETH, USDT (TRC-20, ERC-20) и другие основные сети. Список расширяется.",
  },
  {
    question: "Как быстро деньги приходят на счёт?",
    answer: "Выплаты идут по расписанию или по запросу, в зависимости от тарифа.",
  },
  {
    question: "Нужно ли юрлицо?",
    answer: "Работаем как с юридическими лицами, так и с ИП. Детали уточняются при подключении.",
  },
  {
    question: "Есть ли тестовый режим?",
    answer: "Да. Можно спокойно проверить интеграцию до запуска в продакшн.",
  },
];

const TOKEN_TAGS = ["BTC", "ETH", "USDT", "TRON", "ERC20", "TRC20"];

export function LandingPage({
  mode,
  registrationEnabled = true,
  loading,
  success,
  error,
  loginForm,
  registrationForm,
  publicPages,
  onOpenPublicDocs,
  onOpenPublicPage,
  onModeChange,
  onLoginFormChange,
  onRegistrationFormChange,
  onLogin,
  onRegister,
}: LandingPageProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    if (!authOpen) {
      return;
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAuthOpen(false);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [authOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [mobileMenuOpen]);

  function openAuth(next: "login" | "register") {
    onModeChange(next);
    setMobileMenuOpen(false);
    setAuthOpen(true);
  }

  return (
    <main className="nc-landing">
      <div className="nc-noise" />
      <div className="nc-ambient nc-ambient-a" />
      <div className="nc-ambient nc-ambient-b" />

      <header className="nc-topbar">
        <a className="nc-brand" href="#" aria-label="Noren Digital">
          <span className="nc-brand-dot" />
          <span className="nc-brand-copy">
            <strong>NOREN.DIGITAL</strong>
            <small>Crypto acquiring for ecommerce</small>
          </span>
        </a>

        <button
          className="nc-mobile-menu-trigger"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="nc-mobile-menu-panel"
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          <span className="nc-sr">{mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}</span>
          <span className="nc-mobile-menu-bar" />
          <span className="nc-mobile-menu-bar" />
          <span className="nc-mobile-menu-bar" />
        </button>

        <div className="nc-topbar-actions">
          {headerPages.map((item) => (
            <button
              className="ghost-button"
              key={`header-${item.slug}`}
              onClick={() => onOpenPublicPage(item.slug)}
              type="button"
            >
              {item.title}
            </button>
          ))}
          <button className="ghost-button" onClick={onOpenPublicDocs} type="button">
            API
          </button>
          <button className="ghost-button" onClick={() => openAuth("login")} type="button">
            Войти
          </button>
          <button className="primary-button" onClick={() => openAuth("register")} type="button">
            Подключить процессинг
          </button>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div
          className="nc-mobile-menu-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMobileMenuOpen(false);
            }
          }}
        >
          <div className="nc-mobile-menu-panel" id="nc-mobile-menu-panel" role="dialog" aria-modal="true">
            {headerPages.map((item) => (
              <button
                className="ghost-button nc-mobile-menu-item"
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
            <button
              className="ghost-button nc-mobile-menu-item"
              onClick={() => {
                onOpenPublicDocs();
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              API
            </button>
            <button className="ghost-button nc-mobile-menu-item" onClick={() => openAuth("login")} type="button">
              Войти
            </button>
            <button className="primary-button nc-mobile-menu-item" onClick={() => openAuth("register")} type="button">
              Подключить процессинг
            </button>
          </div>
        </div>
      ) : null}

      <section className="nc-hero">
        <div className="nc-hero-copy">
          <p className="eyebrow">B2B crypto acquiring for CIS ecommerce</p>
          <h1>Ваш магазин уже теряет клиентов, которые платят криптой.</h1>
          <p className="nc-hero-lead">
            Noren подключает крипто-эквайринг к интернет-магазину за один день. Без блокировок,
            без банковских отказов, без потерянных транзакций.
          </p>
          <div className="hero-actions">
            <button className="primary-button nc-main-cta" onClick={() => openAuth("register")} type="button">
              Подключить процессинг
            </button>
            <button className="ghost-button" onClick={onOpenPublicDocs} type="button">
              Посмотреть API
            </button>
          </div>
          <div className="nc-token-strip" aria-hidden="true">
            {TOKEN_TAGS.map((token) => (
              <span key={token}>{token}</span>
            ))}
          </div>
        </div>

        <aside className="nc-hero-side">
          <article className="nc-summary-card nc-summary-card-accent">
            <span className="nc-card-kicker">Проблема рынка</span>
            <h2>Банки отказывают. Платёжки блокируют счета. Международные клиенты не могут заплатить.</h2>
            <p>
              Вы теряете заказы не потому что плохой продукт, а потому что у клиента нет нужного
              способа оплаты.
            </p>
          </article>

          <article className="nc-summary-card">
            <span className="nc-card-kicker">Что получает бизнес</span>
            <div className="nc-summary-grid">
              {HERO_NUMBERS.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="nc-section">
        <div className="nc-section-head">
          <p className="eyebrow">Решение</p>
          <h2>Noren — процессинг, который работает там, где банки пасуют.</h2>
          <p>
            Мы принимаем крипту от ваших клиентов и выплачиваем вам в удобной валюте. Никаких
            заморозок, никаких лимитов, никакой зависимости от банковской инфраструктуры.
          </p>
        </div>
      </section>

      <section className="nc-section">
        <div className="nc-section-head">
          <p className="eyebrow">Преимущества</p>
          <h2>Простой процессинг без лишнего интерфейса</h2>
        </div>
        <div className="nc-group-grid">
          {BENEFITS.map((item) => (
            <article className="nc-group-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nc-section nc-proof-section">
        <div className="nc-section-head">
          <p className="eyebrow">Социальное доказательство</p>
          <h2>Заготовки под будущие кейсы</h2>
        </div>
        <div className="nc-proof-grid">
          <article className="nc-quote-card">
            <p>
              «Подключили Noren за день, в первую же неделю получили 11 заказов от клиентов
              из-за рубежа, которые раньше просто уходили.»
            </p>
            <strong>Интернет-магазин электроники, Минск</strong>
          </article>
          <article className="nc-quote-card">
            <p>
              «Наконец-то процессинг, который не замораживает деньги и не требует справок.»
            </p>
            <strong>Онлайн-магазин одежды, Алматы</strong>
          </article>
        </div>
      </section>

      <section className="nc-section nc-dual-grid">
        <article className="nc-list-card">
          <div className="nc-section-head">
            <p className="eyebrow">Для кого</p>
            <h2>Noren подходит, если вы</h2>
          </div>
          <ul className="nc-check-list">
            {AUDIENCE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="nc-list-card">
          <div className="nc-section-head">
            <p className="eyebrow">Доверие</p>
            <h2>Инфраструктура без лишней бюрократии</h2>
          </div>
          <p className="nc-trust-copy">
            Мы не банк. Мы не требуем корпоративный пакет документов и три месяца ожидания.
            Noren — это инфраструктура, которая просто работает. Платежи проходят. Деньги
            приходят. Бизнес движется.
          </p>
        </article>
      </section>

      <section className="nc-section">
        <div className="nc-section-head">
          <p className="eyebrow">FAQ</p>
          <h2>Коротко по запуску</h2>
        </div>
        <div className="nc-faq-grid">
          {FAQ_ITEMS.map((item) => (
            <article className="nc-faq-card" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nc-cta-block">
        <div className="nc-cta-copy">
          <p className="eyebrow">Финальный CTA</p>
          <h2>Готовы принимать крипту?</h2>
          <p>
            Оставьте заявку — наш менеджер свяжется в течение часа и расскажет, как подключиться
            именно под ваш магазин.
          </p>
        </div>
        <div className="nc-cta-actions">
          <button className="primary-button" onClick={() => openAuth("register")} type="button">
            Оставить заявку
          </button>
          <a className="ghost-button nc-telegram-link" href="#" role="button">
            Написать в Telegram
          </a>
        </div>
      </section>

      <footer className="nc-footer">
        <button className="nc-footer-link" onClick={onOpenPublicDocs} type="button">
          Документация
        </button>
        {footerPages.map((item) => (
          <button
            className="nc-footer-link"
            key={`footer-${item.slug}`}
            onClick={() => onOpenPublicPage(item.slug)}
            type="button"
          >
            {item.title}
          </button>
        ))}
        <button className="nc-footer-link" onClick={() => openAuth("login")} type="button">
          Личный кабинет
        </button>
      </footer>

      {authOpen ? (
        <div
          className="nc-auth-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAuthOpen(false);
            }
          }}
        >
          <div className="auth-card nc-auth-card" id="auth-panel">
            <button className="nc-close" type="button" onClick={() => setAuthOpen(false)} aria-label="Close">
              ×
            </button>

            <div className="mode-switch nc-auth-switch">
              <button
                className={mode === "login" ? "switch-active" : ""}
                type="button"
                onClick={() => onModeChange("login")}
              >
                Вход
              </button>
              <button
                className={mode === "register" ? "switch-active" : ""}
                type="button"
                onClick={() => onModeChange("register")}
                disabled={!registrationEnabled}
              >
                Подключить проект
              </button>
            </div>

            {mode === "login" || !registrationEnabled ? (
              <form className="form nc-auth-form" onSubmit={onLogin}>
                <label className="nc-field">
                  <span className="nc-sr">Email</span>
                  <input
                    value={loginForm.email}
                    onChange={(event) => onLoginFormChange({ ...loginForm, email: event.target.value })}
                    autoComplete="email"
                    required
                    placeholder="Email"
                    type="email"
                  />
                </label>
                <label className="nc-field">
                  <span className="nc-sr">Password</span>
                  <input
                    value={loginForm.password}
                    autoComplete="current-password"
                    minLength={8}
                    required
                    onChange={(event) => onLoginFormChange({ ...loginForm, password: event.target.value })}
                    placeholder="Пароль"
                    type="password"
                  />
                </label>
                <label className="nc-field">
                  <span className="nc-sr">OTP</span>
                  <input
                    value={loginForm.otp_code}
                    onChange={(event) => onLoginFormChange({ ...loginForm, otp_code: event.target.value })}
                    inputMode="numeric"
                    minLength={6}
                    maxLength={8}
                    placeholder="2FA"
                    type="text"
                  />
                </label>
                <button className="primary-button" disabled={loading} type="submit">
                  {loading ? "..." : "Войти"}
                </button>
              </form>
            ) : (
              <form className="form nc-auth-form" onSubmit={onRegister}>
                <div className="nc-register-grid">
                  <label className="nc-field">
                    <span className="nc-sr">Company</span>
                    <input
                      value={registrationForm.company_name}
                      minLength={2}
                      required
                      onChange={(event) =>
                        onRegistrationFormChange({ ...registrationForm, company_name: event.target.value })
                      }
                      placeholder="Компания"
                    />
                  </label>
                  <label className="nc-field">
                    <span className="nc-sr">Owner</span>
                    <input
                      value={registrationForm.owner_full_name}
                      minLength={2}
                      required
                      onChange={(event) =>
                        onRegistrationFormChange({ ...registrationForm, owner_full_name: event.target.value })
                      }
                      placeholder="Владелец"
                    />
                  </label>
                  <label className="nc-field">
                    <span className="nc-sr">Email</span>
                    <input
                      value={registrationForm.owner_email}
                      autoComplete="email"
                      required
                      onChange={(event) =>
                        onRegistrationFormChange({ ...registrationForm, owner_email: event.target.value })
                      }
                      type="email"
                      placeholder="Email"
                    />
                  </label>
                  <label className="nc-field">
                    <span className="nc-sr">Password</span>
                    <input
                      value={registrationForm.password}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      onChange={(event) =>
                        onRegistrationFormChange({ ...registrationForm, password: event.target.value })
                      }
                      type="password"
                      placeholder="Пароль"
                    />
                  </label>
                  <label className="nc-field">
                    <span className="nc-sr">Domain</span>
                    <input
                      value={registrationForm.domain}
                      minLength={3}
                      required
                      onChange={(event) =>
                        onRegistrationFormChange({ ...registrationForm, domain: event.target.value })
                      }
                      placeholder="Домен"
                    />
                  </label>
                  <label className="nc-field">
                    <span className="nc-sr">Description</span>
                    <input
                      value={registrationForm.project_description}
                      maxLength={1000}
                      onChange={(event) =>
                        onRegistrationFormChange({
                          ...registrationForm,
                          project_description: event.target.value,
                        })
                      }
                      placeholder="Описание проекта"
                    />
                  </label>
                </div>
                <button className="primary-button" disabled={loading} type="submit">
                  {loading ? "..." : "Подключить проект"}
                </button>
              </form>
            )}

            {success ? <p className="result-box">{success}</p> : null}
            {error ? <p className="error-box">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
