import { FormEvent, useMemo } from "react";

import type { CreateInvoicePayload, ProjectItem, RateNetworkItem } from "../../api";
import { useTranslation } from "../../i18n";
import {
  formatPayinLimitHint,
  isPayinAmountWithinLimits,
  resolvePayinMinFiatAmount,
} from "../../utils/payinLimits";

type InvoiceIssuanceWizardProps = {
  invoiceForm: CreateInvoicePayload;
  projects: ProjectItem[];
  rates: Array<{ currency: string }>;
  availableNetworks: RateNetworkItem[];
  selectedNetwork: RateNetworkItem | null;
  loading: boolean;
  onInvoiceFormChange: (next: CreateInvoicePayload) => void;
  onCreateInvoice: (event: FormEvent<HTMLFormElement>) => void;
};

export function InvoiceIssuanceWizard({
  invoiceForm,
  projects,
  rates,
  availableNetworks,
  selectedNetwork,
  loading,
  onInvoiceFormChange,
  onCreateInvoice,
}: InvoiceIssuanceWizardProps) {
  const { t } = useTranslation();
  const tokenValue = (invoiceForm.crypto_currency || "USDT").trim().toUpperCase() || "USDT";
  // Amount is entered in the selected token; keep fiat_currency in sync (1:1 on the backend).
  const amountCurrency = tokenValue;

  const hasProject = invoiceForm.project_id.trim() !== "";
  const hasOrderId = invoiceForm.merchant_order_id.trim() !== "";
  const amountOk = isPayinAmountWithinLimits(
    invoiceForm.amount_fiat,
    selectedNetwork,
    amountCurrency,
    tokenValue,
  );
  const minAmount = resolvePayinMinFiatAmount(selectedNetwork, amountCurrency, tokenValue);
  const canSubmit = !loading && hasProject && hasOrderId && amountOk;
  const minLimitHint = formatPayinLimitHint(
    selectedNetwork,
    tokenValue,
    amountCurrency,
    ({ cryptoPart }) => cryptoPart,
  );

  const selectedProjectName =
    projects.find((project) => project.id === invoiceForm.project_id)?.name ?? null;

  const tokenOptions = useMemo(() => {
    if (rates.length === 0) {
      return [tokenValue];
    }
    const fromRates = rates.map((rate) => rate.currency);
    if (fromRates.includes(tokenValue)) {
      return fromRates;
    }
    return [tokenValue, ...fromRates];
  }, [rates, tokenValue]);

  function applyToken(nextToken: string) {
    const crypto = nextToken.trim().toUpperCase() || "USDT";
    onInvoiceFormChange({
      ...invoiceForm,
      crypto_currency: crypto,
      fiat_currency: crypto,
    });
  }

  return (
    <article
      className="mc-surface mw-invoice-create"
      aria-label={t("merchant.widgets.invoiceIssuanceWizard.ariaLabel")}
      id="merchant-invoice-create"
    >
      <header className="mc-surface-header mc-surface-header--row">
        <div>
          <p className="mc-surface-eyebrow">{t("merchant.widgets.invoiceIssuanceWizard.eyebrow")}</p>
          <h2 className="mc-surface-title">{t("merchant.widgets.invoiceIssuanceWizard.title")}</h2>
          <p className="mc-surface-desc" style={{ marginBottom: 0 }}>
            {t("merchant.widgets.invoiceIssuanceWizard.description")}
          </p>
        </div>
        <a className="mw-skip-to-receivables" href="#merchant-receivables">
          {t("merchant.widgets.invoiceIssuanceWizard.skipToList")}
        </a>
      </header>

      <div className="mw-invoice-ready" role="list" aria-label={t("merchant.widgets.invoiceIssuanceWizard.readyAria")}>
        <span
          className={`mw-invoice-ready__chip${hasProject ? " mw-invoice-ready__chip--done" : ""}`}
          role="listitem"
        >
          {t("merchant.widgets.invoiceIssuanceWizard.readyProject")}
        </span>
        <span
          className={`mw-invoice-ready__chip${hasOrderId ? " mw-invoice-ready__chip--done" : ""}`}
          role="listitem"
        >
          {t("merchant.widgets.invoiceIssuanceWizard.readyOrder")}
        </span>
        <span
          className={`mw-invoice-ready__chip${amountOk ? " mw-invoice-ready__chip--done" : ""}`}
          role="listitem"
        >
          {t("merchant.widgets.invoiceIssuanceWizard.readyAmount")}
        </span>
      </div>

      <form className="mc-form mw-invoice-create-form" onSubmit={onCreateInvoice}>
        <div className="mw-invoice-create-section">
          <p className="mw-invoice-create-section-label">
            {t("merchant.widgets.invoiceIssuanceWizard.sectionOrder")}
          </p>
          <div className="mc-form-grid mc-form-grid--2">
            <label className="mc-field">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.project")}</span>
              <select
                value={invoiceForm.project_id}
                onChange={(event) => onInvoiceFormChange({ ...invoiceForm, project_id: event.target.value })}
              >
                <option value="">{t("common.selectProject")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mc-field">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.merchantOrderId")}</span>
              <input
                value={invoiceForm.merchant_order_id}
                onChange={(event) =>
                  onInvoiceFormChange({ ...invoiceForm, merchant_order_id: event.target.value })
                }
                placeholder={t("merchant.widgets.invoiceIssuanceWizard.orderIdPlaceholder")}
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div className="mw-invoice-create-section">
          <p className="mw-invoice-create-section-label">
            {t("merchant.widgets.invoiceIssuanceWizard.sectionPayment")}
          </p>
          <div className="mc-form-grid mc-form-grid--2">
            <label className="mc-field">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.token")}</span>
              <select value={tokenValue} onChange={(event) => applyToken(event.target.value)}>
                {tokenOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="mc-field">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.network")}</span>
              <select
                value={invoiceForm.network}
                onChange={(event) => onInvoiceFormChange({ ...invoiceForm, network: event.target.value })}
              >
                {availableNetworks.length === 0 ? (
                  <option value={invoiceForm.network}>{invoiceForm.network}</option>
                ) : (
                  availableNetworks.map((network) => (
                    <option key={network.network} value={network.network}>
                      {network.network}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="mc-field mw-invoice-amount-field mc-field-span-2">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.amountToPay")}</span>
              <div className="mw-invoice-amount-input">
                <input
                  value={invoiceForm.amount_fiat}
                  min={minAmount ?? "0.00000001"}
                  step="0.00000001"
                  type="number"
                  onChange={(event) =>
                    onInvoiceFormChange({
                      ...invoiceForm,
                      amount_fiat: Number(event.target.value),
                      fiat_currency: tokenValue,
                    })
                  }
                />
                <span className="mw-invoice-amount-currency" aria-hidden="true">
                  {tokenValue}
                </span>
              </div>
              <small>{t("merchant.widgets.invoiceIssuanceWizard.amountInTokenHint", { token: tokenValue })}</small>
            </label>
          </div>

          {selectedNetwork ? (
            <div className="mw-invoice-limits" aria-live="polite">
              <span className="mw-invoice-limits__pair">
                {tokenValue} · {selectedNetwork.network}
              </span>
              <span className="mw-invoice-limits__item">
                {t("merchant.widgets.invoiceIssuanceWizard.minPaymentLabel", {
                  hint: minLimitHint ?? t("common.dash"),
                })}
              </span>
              <span className="mw-invoice-limits__item">
                {selectedNetwork.max_deposit
                  ? t("merchant.widgets.invoiceIssuanceWizard.maxPaymentLabel", {
                      amount: `${selectedNetwork.max_deposit} ${tokenValue}`,
                    })
                  : t("merchant.widgets.invoiceIssuanceWizard.maxPaymentUnlimited")}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mw-invoice-create-actions">
          <p className="mw-invoice-create-summary muted-text">
            {selectedProjectName
              ? t("merchant.widgets.invoiceIssuanceWizard.summaryReady", {
                  project: selectedProjectName,
                  token: tokenValue,
                  network: invoiceForm.network,
                  amount: String(invoiceForm.amount_fiat || 0),
                  fiat: tokenValue,
                })
              : t("merchant.widgets.invoiceIssuanceWizard.summaryNeedProject")}
          </p>
          <button className="primary-button" disabled={!canSubmit} type="submit">
            {loading
              ? t("merchant.widgets.invoiceIssuanceWizard.submitCreating")
              : t("merchant.widgets.invoiceIssuanceWizard.submitCreate")}
          </button>
        </div>
      </form>
    </article>
  );
}
