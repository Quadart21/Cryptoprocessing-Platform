import { useTranslation } from "../../i18n";

export type ApiHubOverviewProps = {
  apiBaseUrl: string;
  hasApiKey: boolean;
  hasProject: boolean;
  hasWebhook: boolean;
  hasSecret: boolean;
};

export function ApiHubOverview({
  apiBaseUrl,
  hasApiKey,
  hasProject,
  hasWebhook,
  hasSecret,
}: ApiHubOverviewProps) {
  const { t } = useTranslation();
  const readyCount = [hasApiKey, hasProject, hasWebhook && hasSecret].filter(Boolean).length;

  return (
    <section className="mw-api-overview" aria-label={t("merchant.widgets.apiHubOverview.ariaLabel")}>
      <div className="mw-api-overview__top">
        <div className="mw-api-overview__heading">
          <p className="mw-api-overview__eyebrow">{t("merchant.widgets.apiHubOverview.eyebrow")}</p>
          <h2 className="mw-api-overview__title">{t("merchant.widgets.apiHubOverview.title")}</h2>
          <p className="mw-api-overview__lead">{t("merchant.widgets.apiHubOverview.lead")}</p>
        </div>
        <div className="mw-api-overview__aside">
          <span className="mw-api-overview__aside-label">{t("merchant.widgets.apiHubOverview.readyLabel")}</span>
          <strong className="mw-api-overview__aside-value">
            {readyCount}/3
          </strong>
          <p className="mw-api-overview__aside-hint">{apiBaseUrl}</p>
        </div>
      </div>

      <div className="mw-api-overview__kpis">
        <article className={`mc-kpi ${hasApiKey ? "mc-kpi--accent" : "mc-kpi--muted"}`}>
          <span className="mc-kpi__label">{t("merchant.widgets.apiHubOverview.kpiKey")}</span>
          <strong className="mc-kpi__value">
            {hasApiKey
              ? t("merchant.widgets.apiHubOverview.kpiOk")
              : t("merchant.widgets.apiHubOverview.kpiNeed")}
          </strong>
          <p className="mc-kpi__hint">{t("merchant.widgets.apiHubOverview.kpiKeyHint")}</p>
        </article>
        <article className={`mc-kpi ${hasProject ? "mc-kpi--accent" : "mc-kpi--muted"}`}>
          <span className="mc-kpi__label">{t("merchant.widgets.apiHubOverview.kpiProject")}</span>
          <strong className="mc-kpi__value">
            {hasProject
              ? t("merchant.widgets.apiHubOverview.kpiOk")
              : t("merchant.widgets.apiHubOverview.kpiNeed")}
          </strong>
          <p className="mc-kpi__hint">{t("merchant.widgets.apiHubOverview.kpiProjectHint")}</p>
        </article>
        <article className={`mc-kpi ${hasWebhook && hasSecret ? "mc-kpi--accent" : "mc-kpi--muted"}`}>
          <span className="mc-kpi__label">{t("merchant.widgets.apiHubOverview.kpiWebhook")}</span>
          <strong className="mc-kpi__value">
            {hasWebhook && hasSecret
              ? t("merchant.widgets.apiHubOverview.kpiOk")
              : t("merchant.widgets.apiHubOverview.kpiNeed")}
          </strong>
          <p className="mc-kpi__hint">{t("merchant.widgets.apiHubOverview.kpiWebhookHint")}</p>
        </article>
      </div>
    </section>
  );
}
