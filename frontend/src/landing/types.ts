import type { FormEvent } from "react";

import type { PublicPageNavigationItem, RegistrationPayload } from "../api";

export type LandingLoginFormState = {
  email: string;
  password: string;
  otp_code: string;
};

export type LandingPageProps = {
  mode: "login" | "register";
  loginStep: "credentials" | "two-factor";
  registrationEnabled?: boolean;
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
  registrationForm: RegistrationPayload;
  publicPages: PublicPageNavigationItem[];
  onOpenPublicDocs: () => void;
  onOpenPublicPage: (slug: string) => void;
  onModeChange: (mode: "login" | "register") => void;
  onLoginFormChange: (next: LandingLoginFormState) => void;
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
