import type { OnboardingStatus } from "../api";
import { useTranslation } from "../i18n";

type OnboardingScreenProps = {
  onboarding: OnboardingStatus | null;
  onLogout: () => void;
};

export function OnboardingScreen({ onboarding, onLogout }: OnboardingScreenProps) {
  const { t } = useTranslation();

  return (
    <main className="shell shell-status">
      <section className="auth-card status-card">
        <p className="eyebrow">{t("merchant.onboarding.eyebrow")}</p>
        <h1>{t("merchant.onboarding.title")}</h1>
        <p className="lead">{t("merchant.onboarding.lead")}</p>
        <div className="result-box status-board">
          <p>
            {t("merchant.onboarding.company")}: {onboarding?.project_name ?? t("merchant.onboarding.notSpecified")}
          </p>
          <p>
            {t("merchant.onboarding.domain")}: {onboarding?.project_domain ?? t("merchant.onboarding.notSpecified")}
          </p>
          <p>
            {t("merchant.onboarding.tenantStatus")}: {onboarding?.tenant_status ?? t("merchant.onboarding.unknown")}
          </p>
          <p>
            {t("merchant.onboarding.projectStatus")}: {onboarding?.project_status ?? t("merchant.onboarding.unknown")}
          </p>
          <p>
            {t("merchant.onboarding.comment")}: {onboarding?.review_comment ?? t("merchant.onboarding.noComment")}
          </p>
        </div>
        <button className="ghost-button" onClick={onLogout} type="button">
          {t("common.logout")}
        </button>
      </section>
    </main>
  );
}
