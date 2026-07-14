import type { FormEvent } from "react";

import type { PublicPageNavigationItem, RegistrationPayload } from "../api";

export type LandingLoginFormState = {
  email: string;
  password: string;
  otp_code: string;
};

export type LandingPageProps = {
  mode: "login" | "register" | "partner";
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
  onModeChange: (mode: "login" | "register" | "partner") => void;
  partnerForm?: {
    email: string;
    password: string;
    full_name: string;
    display_name: string;
    contact_telegram: string;
    payout_address: string;
    payout_network: string;
  };
  onPartnerFormChange?: (next: {
    email: string;
    password: string;
    full_name: string;
    display_name: string;
    contact_telegram: string;
    payout_address: string;
    payout_network: string;
  }) => void;
  onPartnerApply?: (event: FormEvent<HTMLFormElement>) => void;
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
