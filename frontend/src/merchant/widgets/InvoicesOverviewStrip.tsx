import { useMemo } from "react";

import type { InvoiceItem } from "../../api";
import { useTranslation } from "../../i18n";

export type InvoicesOverviewStripProps = {
  invoices: InvoiceItem[];
};

type BucketKey = "awaiting" | "settled" | "attention";

function bucketForStatus(status: string): BucketKey {
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending" || normalized === "confirming") {
    return "awaiting";
  }
  if (normalized === "paid" || normalized === "confirmed") {
    return "settled";
  }
  return "attention";
}

export function InvoicesOverviewStrip({ invoices }: InvoicesOverviewStripProps) {
  const { t } = useTranslation();

  const counts = useMemo(() => {
    let awaiting = 0;
    let settled = 0;
    let attention = 0;
    for (const invoice of invoices) {
      const bucket = bucketForStatus(invoice.status);
      if (bucket === "awaiting") awaiting += 1;
      else if (bucket === "settled") settled += 1;
      else attention += 1;
    }
    return { total: invoices.length, awaiting, settled, attention };
  }, [invoices]);

  return (
    <section className="mw-invoices-overview" aria-label={t("merchant.widgets.invoicesOverview.ariaLabel")}>
      <div className="mw-invoices-overview__top">
        <div className="mw-invoices-overview__heading">
          <p className="mw-invoices-overview__eyebrow">{t("merchant.widgets.invoicesOverview.eyebrow")}</p>
          <h2 className="mw-invoices-overview__title">{t("merchant.widgets.invoicesOverview.title")}</h2>
          <p className="mw-invoices-overview__lead">{t("merchant.widgets.invoicesOverview.lead")}</p>
        </div>
        <div className="mw-invoices-overview__aside">
          <span className="mw-invoices-overview__aside-label">{t("merchant.widgets.invoicesOverview.totalLabel")}</span>
          <strong className="mw-invoices-overview__aside-value">{counts.total}</strong>
        </div>
      </div>

      <div className="mw-invoices-overview__kpis">
        <article className="mc-kpi mc-kpi--primary">
          <span className="mc-kpi__label">{t("merchant.widgets.invoicesOverview.kpiAwaiting")}</span>
          <strong className="mc-kpi__value">{counts.awaiting}</strong>
          <p className="mc-kpi__hint">{t("merchant.widgets.invoicesOverview.kpiAwaitingHint")}</p>
        </article>
        <article className="mc-kpi mc-kpi--accent">
          <span className="mc-kpi__label">{t("merchant.widgets.invoicesOverview.kpiSettled")}</span>
          <strong className="mc-kpi__value">{counts.settled}</strong>
          <p className="mc-kpi__hint">{t("merchant.widgets.invoicesOverview.kpiSettledHint")}</p>
        </article>
        <article className="mc-kpi mc-kpi--muted">
          <span className="mc-kpi__label">{t("merchant.widgets.invoicesOverview.kpiAttention")}</span>
          <strong className="mc-kpi__value">{counts.attention}</strong>
          <p className="mc-kpi__hint">{t("merchant.widgets.invoicesOverview.kpiAttentionHint")}</p>
        </article>
      </div>
    </section>
  );
}
