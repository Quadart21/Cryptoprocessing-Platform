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

  return (
    <div className="nc-modal-overlay lp-auth-overlay" onClick={() => setAuthOpen(false)}>
      <div className="nc-modal lp-auth-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="nc-modal-close" onClick={() => setAuthOpen(false)} type="button">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
              <button className="nc-btn-ghost" onClick={() => setRecoveryMode("request")} type="button">
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
              <button className="nc-btn-ghost" onClick={onBackToLoginCredentials} type="button">
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
              <button className="nc-btn-ghost" onClick={() => setRecoveryMode("reset")} type="button">
                У меня уже есть токен
              </button>
              <button className="nc-btn-ghost" onClick={() => setRecoveryMode("login")} type="button">
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
              <button className="nc-btn-ghost" onClick={() => setRecoveryMode("request")} type="button">
                Запросить новый токен
              </button>
              <button className="nc-btn-ghost" onClick={() => setRecoveryMode("login")} type="button">
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
                  onChange={(e) =>
                    onRegistrationFormChange({ ...registrationForm, project_description: e.target.value })
                  }
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
  );
}
