import { FormEvent } from "react";

import type { CreateInvoicePayload, ProjectItem, RateNetworkItem } from "../../api";
import {
  formatPayinLimitHint,
  isPayinAmountWithinLimits,
  resolvePayinMinFiatAmount,
} from "../../utils/payinLimits";

type InvoiceCreatePanelProps = {
  invoiceForm: CreateInvoicePayload;
  projects: ProjectItem[];
  rates: Array<{ currency: string }>;
  availableNetworks: RateNetworkItem[];
  selectedNetwork: RateNetworkItem | null;
  loading: boolean;
  onInvoiceFormChange: (next: CreateInvoicePayload) => void;
  onCreateInvoice: (event: FormEvent<HTMLFormElement>) => void;
};

export function InvoiceCreatePanel({
  invoiceForm,
  projects,
  rates,
  availableNetworks,
  selectedNetwork,
  loading,
  onInvoiceFormChange,
  onCreateInvoice,
}: InvoiceCreatePanelProps) {
  const amountCurrency = invoiceForm.crypto_currency;
  const minFiatAmount = resolvePayinMinFiatAmount(
    selectedNetwork,
    amountCurrency,
    invoiceForm.crypto_currency,
  );
  const canSubmit =
    !loading &&
    invoiceForm.project_id.trim() !== "" &&
    invoiceForm.merchant_order_id.trim() !== "" &&
    isPayinAmountWithinLimits(
      invoiceForm.amount_fiat,
      selectedNetwork,
      amountCurrency,
      invoiceForm.crypto_currency,
    );
  const minLimitHint = formatPayinLimitHint(
    selectedNetwork,
    invoiceForm.crypto_currency,
    amountCurrency,
  );

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">Новый платёж</p>
        <h2 className="mc-surface-title">Создать инвойс</h2>
        <p className="mc-surface-desc">
          После создания вы получите ссылку на страницу оплаты для клиента. H2H-реквизиты доступны в карточке инвойса.
        </p>
      </header>

      <form className="mc-form" onSubmit={onCreateInvoice}>
        <div className="mc-form-grid mc-form-grid--2">
          <label className="mc-field mc-field-span-2">
            <span>Проект</span>
            <small>К какому проекту относится оплата</small>
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
            <span>Токен</span>
            <small>Чем платит клиент</small>
            <select
              value={invoiceForm.crypto_currency}
              onChange={(event) => {
                const crypto = event.target.value.trim().toUpperCase() || "USDT";
                onInvoiceFormChange({
                  ...invoiceForm,
                  crypto_currency: crypto,
                  fiat_currency: crypto,
                });
              }}
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
            <small>Маршрут перевода</small>
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
            <span>Номер заказа</span>
            <small>Ваш ID во внутренней системе</small>
            <input
              value={invoiceForm.merchant_order_id}
              onChange={(event) =>
                onInvoiceFormChange({ ...invoiceForm, merchant_order_id: event.target.value })
              }
              placeholder="order-001"
            />
          </label>

          <label className="mc-field">
            <span>Сумма</span>
            <small>В {invoiceForm.crypto_currency} — следует за выбранным токеном</small>
            <input
              value={invoiceForm.amount_fiat}
              onChange={(event) =>
                onInvoiceFormChange({
                  ...invoiceForm,
                  amount_fiat: Number(event.target.value),
                  fiat_currency: invoiceForm.crypto_currency,
                })
              }
              min={minFiatAmount ?? "0.00000001"}
              step="0.00000001"
              type="number"
            />
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
            <p>Комиссия сети: {selectedNetwork.network_fee ?? "—"}</p>
            <p>Memo: {selectedNetwork.memo_required ? "нужен" : "не нужен"}</p>
          </div>
        ) : null}

        <div className="mc-form-actions">
          <button className="primary-button" disabled={!canSubmit} type="submit">
            {loading ? "Создаём…" : "Создать инвойс"}
          </button>
        </div>
      </form>
    </article>
  );
}
