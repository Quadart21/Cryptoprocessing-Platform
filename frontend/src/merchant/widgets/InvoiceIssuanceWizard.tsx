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
  const fiatValue = (invoiceForm.fiat_currency ?? "USD").trim().toUpperCase() || "USD";

  const fiatOptions = useMemo(() => {
    const presets = ["USD", "EUR", "GBP", "RUB", "UAH"];
    if (presets.includes(fiatValue)) {
      return presets;
    }
    return [fiatValue, ...presets];
  }, [fiatValue]);

  const hasProject = invoiceForm.project_id.trim() !== "";
  const hasOrderId = invoiceForm.merchant_order_id.trim() !== "";
  const minFiatAmount = resolvePayinMinFiatAmount(selectedNetwork, fiatValue);
  const canSubmit =
    !loading &&
    hasProject &&
    hasOrderId &&
    isPayinAmountWithinLimits(invoiceForm.amount_fiat, selectedNetwork, fiatValue);
  const minLimitHint = formatPayinLimitHint(
    selectedNetwork,
    invoiceForm.crypto_currency,
    fiatValue,
    ({ cryptoPart, minFiat, fiatCurrency }) =>
      t("merchant.widgets.invoiceIssuanceWizard.minLimitApprox", {
        cryptoPart,
        minFiat,
        fiatCurrency,
      }),
  );

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
              <select
                value={invoiceForm.crypto_currency}
                onChange={(event) =>
                  onInvoiceFormChange({ ...invoiceForm, crypto_currency: event.target.value })
                }
              >
                {rates.length === 0 ? <option value="USDT">USDT</option> : null}
                {rates.map((rate) => (
                  <option key={rate.currency} value={rate.currency}>
                    {rate.currency}
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
            <label className="mc-field">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.amountToPay")}</span>
              <input
                value={invoiceForm.amount_fiat}
                min={minFiatAmount ?? "0.00000001"}
                step="0.00000001"
                type="number"
                onChange={(event) =>
                  onInvoiceFormChange({ ...invoiceForm, amount_fiat: Number(event.target.value) })
                }
              />
            </label>
            <label className="mc-field">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.accountingCurrency")}</span>
              <select
                value={fiatValue}
                onChange={(event) =>
                  onInvoiceFormChange({
                    ...invoiceForm,
                    fiat_currency: event.target.value.trim().toUpperCase(),
                  })
                }
              >
                {fiatOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedNetwork ? (
            <div className="mc-hint-box">
              <strong>
                {invoiceForm.crypto_currency} · {selectedNetwork.network}
              </strong>
              <p>
                {t("merchant.widgets.invoiceIssuanceWizard.minPaymentLabel", {
                  hint: minLimitHint ?? t("common.dash"),
                })}
              </p>
              <p>
                {selectedNetwork.max_deposit
                  ? t("merchant.widgets.invoiceIssuanceWizard.maxPaymentLabel", {
                      amount: `${selectedNetwork.max_deposit} ${invoiceForm.crypto_currency}`,
                    })
                  : t("merchant.widgets.invoiceIssuanceWizard.maxPaymentUnlimited")}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mw-invoice-create-actions">
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
