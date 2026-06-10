import type { LandingPageProps } from "./types";
import { usePlatformBrand } from "../brand/PlatformBrandContext";
import { useTranslation } from "../i18n";
import { LandingAuthBrandPanel } from "./LandingAuthBrandPanel";
import { LandingAuthTrustStrip } from "./LandingAuthTrustStrip";

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
  const { brandName } = usePlatformBrand();
  const { t, ta } = useTranslation();
  const regSteps = ta<{ id: string; label: string }>("auth.regSteps");

  if (!authOpen) {
    return null;
  }

  const mainHeadline =
    mode === "register" && registrationEnabled
      ? t("auth.registerTitle")
      : recoveryMode === "request"
        ? t("auth.recoveryRequestTitle")
        : recoveryMode === "reset"
          ? t("auth.recoveryResetTitle")
          : loginStep === "two-factor"
            ? t("auth.twoFactorTitle")
            : t("auth.loginTitle");

  const mainSub =
    mode === "register" && registrationEnabled
      ? t("auth.registerSub")
      : recoveryMode === "request"
        ? t("auth.recoveryRequestSub")
        : recoveryMode === "reset"
          ? t("auth.recoveryResetSub")
          : loginStep === "two-factor"
            ? t("auth.twoFactorSub")
            : t("auth.loginSub");

  return (
    <div className="lp-auth-overlay" onClick={() => setAuthOpen(false)}>
      <div className="lp-auth-shell" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="lp-auth-close" onClick={() => setAuthOpen(false)} type="button" aria-label={t("common.close")}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="lp-auth-layout">
          <aside className="lp-auth-aside">
            <div className="lp-auth-aside-orb lp-auth-aside-orb--one" aria-hidden />
            <div className="lp-auth-aside-orb lp-auth-aside-orb--two" aria-hidden />
            <LandingAuthBrandPanel registrationEnabled={registrationEnabled} />
          </aside>

          <div className="lp-auth-main">
            <div className="lp-auth-brand-mobile">
              <LandingAuthBrandPanel compact registrationEnabled={registrationEnabled} />
            </div>

            <p className="lp-auth-kicker">{brandName}</p>
            <h3 className="lp-auth-title">{mainHeadline}</h3>
            <p className="lp-auth-lede">{mainSub}</p>

            <div className="lp-auth-switch">
              <button
                className={mode === "login" || !registrationEnabled ? "lp-auth-switch-active" : ""}
                onClick={() => onModeChange("login")}
                type="button"
              >
                {t("auth.tabLogin")}
              </button>
              <button
                className={mode === "register" && registrationEnabled ? "lp-auth-switch-active" : ""}
                onClick={() => onModeChange("register")}
                disabled={!registrationEnabled}
                type="button"
              >
                {t("auth.tabRegister")}
              </button>
            </div>

            {mode === "register" && registrationEnabled ? (
              <ol className="lp-auth-reg-steps" aria-label={t("auth.regStepsAria")}>
                {regSteps.map((step, index) => (
                  <li
                    className={`lp-auth-reg-step${index === 0 ? " lp-auth-reg-step--active" : ""}`}
                    key={step.id}
                  >
                    <span className="lp-auth-reg-step-num">{index + 1}</span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            {mode === "login" || !registrationEnabled ? (
              recoveryMode === "login" && loginStep === "credentials" ? (
                <form className="nc-form" onSubmit={onLogin}>
                  <label>
                    <span>{t("common.email")}</span>
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
                    <span>{t("common.password")}</span>
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
                    {loading ? t("auth.loggingIn") : t("common.continue")}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("request")} type="button">
                    {t("auth.forgotPassword")}
                  </button>
                </form>
              ) : recoveryMode === "login" && loginStep === "two-factor" ? (
                <form className="nc-form" onSubmit={onLoginTwoFactor}>
                  <div className="result-box lp-auth-2fa-hint">
                    <p className="lp-auth-2fa-email">{loginForm.email}</p>
                    <p className="lp-auth-2fa-text">{t("auth.twoFactorHint")}</p>
                  </div>
                  <label>
                    <span>{t("auth.twoFactorCode")}</span>
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
                    {loading ? t("auth.verifying") : t("common.login")}
                  </button>
                  <button className="nc-btn-ghost" onClick={onBackToLoginCredentials} type="button">
                    {t("auth.backToPassword")}
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
                    <span>{t("auth.accountEmail")}</span>
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
                    {loading ? t("auth.sending") : t("auth.sendToken")}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("reset")} type="button">
                    {t("auth.haveToken")}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("login")} type="button">
                    {t("auth.backToLogin")}
                  </button>
                </form>
              ) : (
                <form className="nc-form" onSubmit={onSetRecoveredPassword}>
                  <label>
                    <span>{t("auth.tokenFromEmail")}</span>
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
                    <span>{t("auth.newPassword")}</span>
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
                    <span>{t("auth.confirmPassword")}</span>
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
                    {loading ? t("auth.saving") : t("auth.savePassword")}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("request")} type="button">
                    {t("auth.requestTokenAgain")}
                  </button>
                  <button className="nc-btn-ghost" onClick={() => setRecoveryMode("login")} type="button">
                    {t("auth.backToLogin")}
                  </button>
                </form>
              )
            ) : (
              <form className="nc-form" onSubmit={onRegister}>
                <div className="nc-form-grid">
                  <label>
                    <span>{t("auth.company")}</span>
                    <input
                      value={registrationForm.company_name}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, company_name: e.target.value })}
                      required
                      autoComplete="organization"
                    />
                  </label>
                  <label>
                    <span>{t("auth.owner")}</span>
                    <input
                      value={registrationForm.owner_full_name}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, owner_full_name: e.target.value })}
                      required
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    <span>{t("common.email")}</span>
                    <input
                      type="email"
                      value={registrationForm.owner_email}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, owner_email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    <span>{t("common.password")}</span>
                    <input
                      type="password"
                      value={registrationForm.password}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, password: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="lp-auth-span-2">
                    <span>{t("auth.projectDomain")}</span>
                    <input
                      placeholder="pay.example.com"
                      value={registrationForm.domain}
                      onChange={(e) => onRegistrationFormChange({ ...registrationForm, domain: e.target.value })}
                      required
                      autoComplete="url"
                    />
                  </label>
                  <label className="lp-auth-span-2">
                    <span>{t("auth.descriptionOptional")}</span>
                    <input
                      value={registrationForm.project_description}
                      onChange={(e) =>
                        onRegistrationFormChange({ ...registrationForm, project_description: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button className="nc-btn-primary nc-btn-lg" disabled={loading} type="submit">
                  {loading ? t("auth.creating") : t("auth.createTenant")}
                </button>
              </form>
            )}

            {success ? <p className="nc-success">{success}</p> : null}
            {error ? <p className="nc-error">{error}</p> : null}

            <LandingAuthTrustStrip />
          </div>
        </div>
      </div>
    </div>
  );
}
