import { FormEvent, useEffect, useState } from "react";

import { login, register, requestPasswordRecovery, setPasswordByRecoveryToken } from "../api";
import {
  applyAsPartner,
  fetchPublicAffiliateConfig,
  readAffiliateRef,
  storeAffiliateRef,
  trackAffiliateClick,
} from "../api/partner";
import { AppController } from "../AppController";
import { initialLoginForm, initialPartnerApplyForm, initialRegistrationForm } from "../constants/forms";
import { resolveDocsSiteUrl } from "../config/siteHost";
import { usePublicSiteNavigation } from "../hooks/usePublicSiteNavigation";
import { useSession } from "../hooks/useSession";
import { useFlashMessages } from "../i18n/useFlashMessages";
import { LandingExperienceRoot } from "../landing/LandingExperienceRoot";
import { PublicCmsPageLazy, PublicDocsPageLazy } from "../app/controller/lazyScreens";

export function PublicMarketingView() {
  const session = useSession();
  if (session.token) {
    return <AppController />;
  }
  return <AnonymousMarketing applyAccessToken={session.applyAccessToken} />;
}

function AnonymousMarketing({
  applyAccessToken,
}: {
  applyAccessToken: (accessToken: string, refreshToken?: string | null) => void;
}) {
  const flash = useFlashMessages();
  const { publicRoute, publicNavigationItems, publicPageDetail, openPublicPage } = usePublicSiteNavigation({
    authenticated: false,
  });
  const [mode, setMode] = useState<"login" | "register" | "partner">("login");
  const [partnerForm, setPartnerForm] = useState(initialPartnerApplyForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [loginStep, setLoginStep] = useState<"credentials" | "two-factor">("credentials");
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState("");
  const [passwordResetForm, setPasswordResetForm] = useState({
    token: "",
    password: "",
    confirmPassword: "",
  });
  const [registrationForm, setRegistrationForm] = useState(initialRegistrationForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref) {
      return;
    }
    void (async () => {
      let clickMode = "last_click";
      try {
        const publicCfg = await fetchPublicAffiliateConfig();
        clickMode = publicCfg.click_mode || "last_click";
      } catch {
        // fallback last_click
      }
      storeAffiliateRef(ref, clickMode);
      void trackAffiliateClick(ref, window.location.pathname).catch(() => undefined);
    })();
  }, []);

  if (publicRoute.view === "docs") {
    return (
      <PublicDocsPageLazy
        onBackToLanding={() => openPublicPage("landing")}
        onOpenLogin={() => {
          setMode("login");
          openPublicPage("landing");
        }}
        onOpenRegister={() => {
          setMode("register");
          openPublicPage("landing");
        }}
      />
    );
  }

  if (publicRoute.view === "cms") {
    return (
      <PublicCmsPageLazy
        loading={busy}
        page={publicPageDetail}
        onBackToLanding={() => openPublicPage("landing")}
      />
    );
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      const auth = await login(loginForm.email, loginForm.password);
      applyAccessToken(auth.access_token, auth.refresh_token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === flash.twoFactorRequired() || message === "2FA code is required to sign in.") {
        setLoginStep("two-factor");
        setError(null);
      } else {
        setError(flash.loginFailed(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLoginTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      const auth = await login(loginForm.email, loginForm.password, loginForm.otp_code);
      applyAccessToken(auth.access_token, auth.refresh_token);
    } catch (err) {
      setError(flash.loginFailed(err));
    } finally {
      setBusy(false);
    }
  }

  function handleBackToLoginCredentials() {
    setLoginStep("credentials");
    setError(null);
    setLoginForm((current) => ({ ...current, otp_code: "" }));
  }

  function handleAuthModeChange(next: "login" | "register" | "partner") {
    setMode(next);
    setLoginStep("credentials");
    setError(null);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      let cookieDays = 60;
      try {
        const publicCfg = await fetchPublicAffiliateConfig();
        cookieDays = publicCfg.cookie_days || 60;
      } catch {
        // keep default
      }
      const referralCode = readAffiliateRef(cookieDays) || registrationForm.referral_code || undefined;
      const result = await register({
        ...registrationForm,
        referral_code: referralCode || undefined,
      });
      setSuccess(result.message);
      setMode("login");
      setLoginForm({
        email: registrationForm.owner_email,
        password: registrationForm.password,
        otp_code: "",
      });
      setRegistrationForm(initialRegistrationForm);
    } catch (err) {
      setError(flash.projectConnectFailed(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePartnerApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      const result = await applyAsPartner(partnerForm);
      setSuccess(result.message);
      setMode("login");
      setLoginForm({
        email: partnerForm.email,
        password: partnerForm.password,
        otp_code: "",
      });
      setPartnerForm(initialPartnerApplyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подать заявку партнёра.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestPasswordRecovery(email: string) {
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      const result = await requestPasswordRecovery(email);
      setSuccess(result.message);
      setPasswordRecoveryEmail(email.trim());
    } catch (err) {
      setError(flash.passwordRecoveryFailed(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSetRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      if (passwordResetForm.password !== passwordResetForm.confirmPassword) {
        throw new Error(flash.passwordMismatch());
      }
      const result = await setPasswordByRecoveryToken(passwordResetForm.token, passwordResetForm.password);
      setSuccess(result.message);
      setMode("login");
      setLoginStep("credentials");
      setLoginForm((current) => ({
        ...current,
        email: result.email,
        password: "",
        otp_code: "",
      }));
      setPasswordResetForm({ token: "", password: "", confirmPassword: "" });
    } catch (err) {
      setError(flash.passwordSetFailed(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LandingExperienceRoot
      mode={mode}
      loginStep={loginStep}
      registrationEnabled
      loading={busy}
      success={success}
      error={error}
      loginForm={loginForm}
      passwordRecoveryEmail={passwordRecoveryEmail}
      passwordResetForm={passwordResetForm}
      registrationForm={registrationForm}
      partnerForm={partnerForm}
      onModeChange={handleAuthModeChange}
      onLoginFormChange={setLoginForm}
      onPasswordRecoveryEmailChange={setPasswordRecoveryEmail}
      onPasswordResetFormChange={setPasswordResetForm}
      onRegistrationFormChange={setRegistrationForm}
      onPartnerFormChange={setPartnerForm}
      onPartnerApply={handlePartnerApply}
      onLogin={handleLogin}
      onLoginTwoFactor={handleLoginTwoFactor}
      onBackToLoginCredentials={handleBackToLoginCredentials}
      onRequestPasswordRecovery={(email) => void handleRequestPasswordRecovery(email)}
      onRegister={handleRegister}
      onSetRecoveredPassword={handleSetRecoveredPassword}
      onOpenPublicDocs={() => {
        window.location.href = resolveDocsSiteUrl();
      }}
      publicPages={publicNavigationItems}
      onOpenPublicPage={(slug) => openPublicPage("cms", slug)}
    />
  );
}
