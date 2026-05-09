import type { LandingPageProps } from "./types";

export type LandingAuthLayerProps = Pick<
  LandingPageProps,
  | "mode"
  | "registrationEnabled"
  | "loading"
  | "success"
  | "error"
  | "loginForm"
  | "passwordRecoveryEmail"
  | "passwordResetForm"
  | "registrationForm"
  | "onModeChange"
  | "onLoginFormChange"
  | "onPasswordRecoveryEmailChange"
  | "onPasswordResetFormChange"
  | "onRegistrationFormChange"
  | "onLogin"
  | "onLoginTwoFactor"
  | "onBackToLoginCredentials"
  | "onRequestPasswordRecovery"
  | "onRegister"
  | "onSetRecoveredPassword"
> & {
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  recoveryMode: "login" | "request" | "reset";
  setRecoveryMode: (mode: "login" | "request" | "reset") => void;
  loginStep: LandingPageProps["loginStep"];
};

export function LandingAuthLayer({
  authOpen,
  setAuthOpen,
  mode,
  registrationEnabled = true,
  loading,
  success,
  error,
  loginForm,
  passwordRecoveryEmail,
  passwordResetForm,
  registrationForm,
  loginStep,
  recoveryMode,
  setRecoveryMode,
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
}: LandingAuthLayerProps) {
  if (!authOpen) {
    return null;
  }

  const mainHeadline =
    mode === "register" && registrationEnabled
      ? "Регистрация проекта"
      : recoveryMode === "request"
        ? "Восстановление доступа"
        : recoveryMode === "reset"
          ? "Новый пароль"
          : loginStep === "two-factor"
            ? "Код 2FA"
            : "Вход в кабинет";

  const mainSub =
    mode === "register" && registrationEnabled
      ? "Компания, владелец и домен — дальше вы попадёте в консоль мерчанта."
      : recoveryMode === "request"
        ? "Отправим одноразовый токен на email учётной записи."
        : recoveryMode === "reset"
          ? "Вставьте токен из письма и задайте новый пароль."
          : loginStep === "two-factor"
            ? "Введите код из приложения аутентификатора."
            : "Рабочий email и пароль от аккаунта.";

  return (
    <div className="lp-auth-overlay" onClick={() => setAuthOpen(false)}>
      <div className="lp-auth-shell" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="lp-auth-close" onClick={() => setAuthOpen(false)} type="button" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="lp-auth-layout">
          <aside className="lp-auth-aside" aria-hidden="true">
            <div className="lp-auth-brand">
              <div className="lp-auth-brand-mark">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3L4 7v10l8 4 8-4V7l-8-4z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <path d="M12 12l8-5M12 12v10M12 12L4 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </div>
              <h2>
                Noren<span>Digital</span>
              </h2>
              <p>Приём крипто-платежей, инвойсы и сводки — в одном тенанте. Без лишних экранов.</p>
              <div className="lp-auth-brand-footer">Merchant · Platform · API</div>
            </div>
          </aside>

          <div className="lp-auth-main">
            <p className="lp-auth-kicker">Кабинет</p>
            <h3 className="lp-auth-title">{mainHeadline}</h3>
            <p className="lp-auth-lede">{mainSub}</p>

            <div className="lp-auth-switch">
              <button
                className={mode === "login" || !registrationEnabled ? "lp-auth-switch-active" : ""}
                onClick={() => onModeChange("login")}
                type="button"
              >
                Вход
              </button>
              <button
                className={mode === "register" && registrationEnabled ? "lp-auth-switch-active" : ""}
                onClick={() => onModeChange("register")}
                disabled={!registrationEnabled}
                type="button"
              >
                Новый проект
              </button>
            </div>

            {mode === "login" || !registrationEnabled ? (
              recoveryMode === "login" && loginStep === "credentials" ? (
                <form className="nc-form" onSubmit={onLogin}>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={loginForm.email}
                      onChange={(e) => onLoginFormChange({ ...loginForm, email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    <span>Пароль</span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => onLoginFormChange({ ...loginForm, password: e.target.value })}
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "Входим…" : "Продолжить"}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("request")} type="button">
                    Забыли пароль?
                  </button>
                </form>
              ) : recoveryMode === "login" && loginStep === "two-factor" ? (
                <form className="nc-form" onSubmit={onLoginTwoFactor}>
                  <div className="result-box lp-auth-2fa-hint">
                    <p className="lp-auth-2fa-email">{loginForm.email}</p>
                    <p className="lp-auth-2fa-text">Код из приложения (Google Authenticator и т.п.).</p>
                  </div>
                  <label>
                    <span>Код 2FA</span>
                    <input
                      type="text"
                      value={loginForm.otp_code}
                      onChange={(e) => onLoginFormChange({ ...loginForm, otp_code: e.target.value })}
                      inputMode="numeric"
                      maxLength={8}
                      autoFocus
                      required
                      autoComplete="one-time-code"
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "Проверка…" : "Войти"}
                  </button>
                  <button className="nc-btn-ghost" onClick={onBackToLoginCredentials} type="button">
                    ← Назад к паролю
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
                    <span>Email учётной записи</span>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={passwordRecoveryEmail}
                      onChange={(e) => onPasswordRecoveryEmailChange(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "Отправка…" : "Отправить ссылку / токен"}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("reset")} type="button">
                    У меня уже есть токен
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("login")} type="button">
                    ← Ко входу
                  </button>
                </form>
              ) : (
                <form className="nc-form" onSubmit={onSetRecoveredPassword}>
                  <label>
                    <span>Токен из письма</span>
                    <input
                      value={passwordResetForm.token}
                      onChange={(e) =>
                        onPasswordResetFormChange({
                          ...passwordResetForm,
                          token: e.target.value,
                        })
                      }
                      required
                      autoComplete="one-time-code"
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
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    <span>Повтор пароля</span>
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
                      autoComplete="new-password"
                    />
                  </label>
                  <button className="nc-btn-primary" disabled={loading} type="submit">
                    {loading ? "Сохранение…" : "Сохранить пароль"}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("request")} type="button">
                    Запросить токен ещё раз
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("login")} type="button">
                    ← Ко входу
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
                      autoComplete="organization"
                    />
                  </label>
                  <label>
                    <span>Владелец</span>
                    <input
                      value={registrationForm.owner_full_name}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, owner_full_name: e.target.value })}
                      required
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={registrationForm.owner_email}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, owner_email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    <span>Пароль</span>
                    <input
                      type="password"
                      value={registrationForm.password}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, password: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="lp-auth-span-2">
                    <span>Домен проекта</span>
                    <input
                      placeholder="pay.example.com"
                      value={registrationForm.domain}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, domain: e.target.value })}
                      required
                      autoComplete="url"
                    />
                  </label>
                  <label className="lp-auth-span-2">
                    <span>Описание (необязательно)</span>
                    <input
                      value={registrationForm.project_description}
                      onChange={(e) =>
                        onRegistrationFormChange({ ...registrationForm, project_description: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button className="nc-btn-primary nc-btn-lg" disabled={loading} type="submit">
                  {loading ? "Создаём…" : "Создать тенант и войти"}
                </button>
              </form>
            )}

            {success ? <p className="nc-success">{success}</p> : null}
            {error ? <p className="nc-error">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
