import { useEffect, useState } from "react";

import { isAppSubdomain } from "../config/siteHost";
import {
  clearAuthQueryFromUrl,
  readAuthModeFromQuery,
  redirectMarketingAuthToApp,
} from "../config/siteHostRedirect";
import { LandingAuthLayer } from "./LandingAuthLayer";
import { LandingSiteChrome } from "./LandingSiteChrome";
import type { LandingPageProps } from "./types";

export function LandingExperienceRoot(props: LandingPageProps) {
  const {
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
    partnerForm,
    publicPages,
    onOpenPublicDocs,
    onOpenPublicPage,
    onModeChange,
    onLoginFormChange,
    onPasswordRecoveryEmailChange,
    onPasswordResetFormChange,
    onRegistrationFormChange,
    onPartnerFormChange,
    onPartnerApply,
    onLogin,
    onLoginTwoFactor,
    onBackToLoginCredentials,
    onRequestPasswordRecovery,
    onRegister,
    onSetRecoveredPassword,
  } = props;

  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [recoveryMode, setRecoveryMode] = useState<"login" | "request" | "reset">("login");

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
    const authMode = readAuthModeFromQuery();
    if (!authMode || !isAppSubdomain()) {
      return;
    }
    onModeChange(authMode);
    setRecoveryMode("login");
    setAuthOpen(true);
    clearAuthQueryFromUrl();
  }, [onModeChange]);

  useEffect(() => {
    if (!authOpen) {
      return;
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAuthOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [authOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
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
    if (redirectMarketingAuthToApp(next)) {
      return;
    }
    onModeChange(next);
    setRecoveryMode("login");
    setMobileMenuOpen(false);
    setAuthOpen(true);
  };

  return (
    <main className="lpx-landing nc-landing lp-root lp-theme-lime">
      <LandingSiteChrome
        mobileMenuOpen={mobileMenuOpen}
        openAuth={openAuth}
        openFaqIndex={openFaqIndex}
        publicPages={publicPages}
        setMobileMenuOpen={setMobileMenuOpen}
        setOpenFaqIndex={setOpenFaqIndex}
        onOpenPublicDocs={onOpenPublicDocs}
        onOpenPublicPage={onOpenPublicPage}
      />

      <LandingAuthLayer
        authOpen={authOpen}
        error={error}
        loading={loading}
        loginForm={loginForm}
        loginStep={loginStep}
        mode={mode}
        passwordRecoveryEmail={passwordRecoveryEmail}
        passwordResetForm={passwordResetForm}
        recoveryMode={recoveryMode}
        registrationEnabled={registrationEnabled}
        registrationForm={registrationForm}
        partnerForm={partnerForm}
        setAuthOpen={setAuthOpen}
        setRecoveryMode={setRecoveryMode}
        success={success}
        onBackToLoginCredentials={onBackToLoginCredentials}
        onLogin={onLogin}
        onLoginFormChange={onLoginFormChange}
        onLoginTwoFactor={onLoginTwoFactor}
        onModeChange={onModeChange}
        onPasswordRecoveryEmailChange={onPasswordRecoveryEmailChange}
        onPasswordResetFormChange={onPasswordResetFormChange}
        onPartnerApply={onPartnerApply}
        onPartnerFormChange={onPartnerFormChange}
        onRegister={onRegister}
        onRegistrationFormChange={onRegistrationFormChange}
        onRequestPasswordRecovery={onRequestPasswordRecovery}
        onSetRecoveredPassword={onSetRecoveredPassword}
      />
    </main>
  );
}
