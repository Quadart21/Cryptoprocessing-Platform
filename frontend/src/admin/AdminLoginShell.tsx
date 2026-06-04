import { useState, type FormEvent } from "react";

import { LandingAuthLayer } from "../landing/LandingAuthLayer";
import type { LandingLoginFormState } from "../landing/types";
import type { RegistrationPayload } from "../api";
import { resolveMainSiteOrigin } from "../config/siteHost";

type AdminLoginShellProps = {
  loading: boolean;
  success: string | null;
  error: string | null;
  loginForm: LandingLoginFormState;
  passwordRecoveryEmail: string;
  passwordResetForm: {
    token: string;
    password: string;
    confirmPassword: string;
  };
  loginStep: "credentials" | "two-factor";
  onLoginFormChange: (next: LandingLoginFormState) => void;
  onPasswordRecoveryEmailChange: (next: string) => void;
  onPasswordResetFormChange: (next: {
    token: string;
    password: string;
    confirmPassword: string;
  }) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onLoginTwoFactor: (event: FormEvent<HTMLFormElement>) => void;
  onBackToLoginCredentials: () => void;
  onRequestPasswordRecovery: (email: string) => void;
  onSetRecoveredPassword: (event: FormEvent<HTMLFormElement>) => void;
};

const emptyRegistrationForm: RegistrationPayload = {
  company_name: "",
  owner_full_name: "",
  owner_email: "",
  password: "",
  domain: "",
  project_description: "",
  timezone: "Europe/Amsterdam",
  base_currency: "USD",
  plan: "default",
};

export function AdminLoginShell(props: AdminLoginShellProps) {
  const [recoveryMode, setRecoveryMode] = useState<"login" | "request" | "reset">("login");
  const mainSite = resolveMainSiteOrigin();

  return (
    <div className="admin-site-login">
      <header className="admin-site-login__top">
        <a className="admin-site-login__brand" href={mainSite}>
          Noren<span>Digital</span>
        </a>
        <span className="admin-site-login__badge">Platform admin</span>
      </header>
      <LandingAuthLayer
        authOpen
        setAuthOpen={() => undefined}
        mode="login"
        registrationEnabled={false}
        recoveryMode={recoveryMode}
        setRecoveryMode={setRecoveryMode}
        registrationForm={emptyRegistrationForm}
        onModeChange={() => undefined}
        onRegistrationFormChange={() => undefined}
        onRegister={(event) => event.preventDefault()}
        {...props}
      />
    </div>
  );
}
