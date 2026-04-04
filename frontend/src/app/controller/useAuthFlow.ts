import { useCallback, useState } from "react";

import { login, register, type RegistrationPayload } from "../../api";
import { useSession } from "../../hooks/useSession";
import { initialLoginForm, initialRegistrationForm } from "../../constants/forms";

export function useAuthFlow() {
  const { applyAccessToken, clearSession } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registrationForm, setRegistrationForm] = useState<RegistrationPayload>(initialRegistrationForm);

  const handleLogin = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const auth = await login(loginForm.email, loginForm.password, loginForm.otp_code);
        applyAccessToken(auth.access_token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка входа.");
      } finally {
        setLoading(false);
      }
    },
    [loginForm, applyAccessToken],
  );

  const handleRegister = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const result = await register(registrationForm);
        setSuccess(result.message);
        setMode("login");
        setLoginForm({
          email: registrationForm.owner_email,
          password: registrationForm.password,
          otp_code: "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка подключения проекта.");
      } finally {
        setLoading(false);
      }
    },
    [registrationForm],
  );

  const handleLogout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return {
    mode,
    setMode,
    loading,
    error,
    success,
    loginForm,
    setLoginForm,
    registrationForm,
    setRegistrationForm,
    handleLogin,
    handleRegister,
    handleLogout,
  };
}