import { FormEvent, useMemo } from "react";

import type { CreateInvoicePayload, ProjectItem, RateNetworkItem } from "../../api";
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
  const minLimitHint = formatPayinLimitHint(selectedNetwork, invoiceForm.crypto_currency, fiatValue);

  return (
    <article className="mc-surface mw-invoice-create" aria-label="Создание инвойса" id="merchant-invoice-create">
      <header className="mc-surface-header mc-surface-header--row">
        <div>
          <p className="mc-surface-eyebrow">Новый счёт</p>
          <h2 className="mc-surface-title">Создать инвойс</h2>
          <p className="mc-surface-desc" style={{ marginBottom: 0 }}>
            Один экран: проект, номер заказа, токен, сеть и сумма в валюте учёта. После создания счёт появится в списке
            ниже.
          </p>
        </div>
        <a className="mw-skip-to-receivables" href="#merchant-receivables">
          К списку инвойсов ↓
        </a>
      </header>

      <form className="mc-form mw-invoice-create-form" onSubmit={onCreateInvoice}>
        <div className="mw-invoice-create-section">
          <p className="mw-invoice-create-section-label">Заказ</p>
          <div className="mc-form-grid mc-form-grid--2">
            <label className="mc-field">
              <span>Проект</span>
              <select
                value={invoiceForm.project_id}
                onChange={(event) => onInvoiceFormChange({ ...invoiceForm, project_id: event.target.value })}
              >
                <option value="">Выберите проект</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mc-field">
              <span>Внутренний номер заказа</span>
              <input
                value={invoiceForm.merchant_order_id}
                onChange={(event) =>
                  onInvoiceFormChange({ ...invoiceForm, merchant_order_id: event.target.value })
                }
                placeholder="order-2048"
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div className="mw-invoice-create-section">
          <p className="mw-invoice-create-section-label">Оплата</p>
          <div className="mc-form-grid mc-form-grid--2">
            <label className="mc-field">
              <span>Токен</span>
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
              <span>Сеть</span>
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
              <span>Сумма к оплате</span>
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
              <span>Валюта учёта</span>
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
              <p>Мин. оплата: {minLimitHint ?? "—"}</p>
              <p>
                Макс. оплата:{" "}
                {selectedNetwork.max_deposit
                  ? `${selectedNetwork.max_deposit} ${invoiceForm.crypto_currency}`
                  : "—"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mw-invoice-create-actions">
          <button className="primary-button" disabled={!canSubmit} type="submit">
            {loading ? "Создаём…" : "Создать инвойс"}
          </button>
        </div>
      </form>
    </article>
  );
}
