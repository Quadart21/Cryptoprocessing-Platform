import type { OnboardingStatus } from "../api";

type OnboardingScreenProps = {
  onboarding: OnboardingStatus | null;
  onLogout: () => void;
};

export function OnboardingScreen({ onboarding, onLogout }: OnboardingScreenProps) {
  return (
    <main className="shell shell-status">
      <section className="auth-card status-card">
        <p className="eyebrow">Онбординг проекта</p>
        <h1>Статус вашей заявки</h1>
        <p className="lead">
          Полный доступ к кабинету откроется после одобрения супер-админом.
        </p>
        <div className="result-box status-board">
          <p>Компания: {onboarding?.project_name ?? "Не указано"}</p>
          <p>Домен: {onboarding?.project_domain ?? "Не указано"}</p>
          <p>Статус tenant: {onboarding?.tenant_status ?? "Неизвестно"}</p>
          <p>Статус проекта: {onboarding?.project_status ?? "Неизвестно"}</p>
          <p>Комментарий: {onboarding?.review_comment ?? "Пока без комментария"}</p>
        </div>
        <button className="ghost-button" onClick={onLogout} type="button">
          Выйти
        </button>
      </section>
    </main>
  );
}
