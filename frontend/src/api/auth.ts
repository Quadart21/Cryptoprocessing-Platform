import { request, authHeaders } from "./base";
import type {
  LoginResponse,
  CurrentUser,
  TwoFactorStatus,
  TwoFactorSetup,
} from "./base";

export function login(
  email: string,
  password: string,
  otp_code?: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/client/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, otp_code }),
  });
}

export function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const headers = authHeaders(token);
  return request<CurrentUser>("/admin/me", { headers }).catch((adminError: unknown) => {
    const status = typeof adminError === "object" && adminError !== null && "status" in adminError
      ? (adminError as { status?: number }).status
      : undefined;
    if (status && status !== 401 && status !== 403 && status !== 404) {
      throw adminError;
    }
    return request<CurrentUser>("/client/me", { headers });
  });
}

export function fetchTwoFactorStatus(token: string): Promise<TwoFactorStatus> {
  return request<TwoFactorStatus>("/client/security/2fa/status", {
    headers: authHeaders(token),
  });
}

export function setupTwoFactor(token: string): Promise<TwoFactorSetup> {
  return request<TwoFactorSetup>("/client/security/2fa/setup", {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function enableTwoFactor(token: string, code: string): Promise<TwoFactorStatus> {
  return request<TwoFactorStatus>("/client/security/2fa/enable", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ code }),
  });
}

export function disableTwoFactor(
  token: string,
  payload: { password: string; code?: string },
): Promise<TwoFactorStatus> {
  return request<TwoFactorStatus>("/client/security/2fa/disable", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function changeClientPassword(
  token: string,
  payload: { current_password: string; new_password: string },
): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>("/client/security/change-password", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}
