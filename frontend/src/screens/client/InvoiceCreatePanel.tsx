import { FormEvent } from "react";

import type { CreateInvoicePayload, ProjectItem, RateNetworkItem } from "../../api";

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
  const canSubmit =
    !loading &&
    invoiceForm.project_id.trim() !== "" &&
    invoiceForm.merchant_order_id.trim() !== "" &&
    Number.isFinite(invoiceForm.amount_fiat) &&
    invoiceForm.amount_fiat > 0;

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">Новый платёж</p>
        <h2 className="mc-surface-title">Создать инвойс</h2>
        <p className="mc-surface-desc">
          Выберите проект, токен и сеть. После создания вы получите адрес и сможете отследить статус в списке справа.
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
            <small>В токене; лимиты см. ниже</small>
            <input
              value={invoiceForm.amount_fiat}
              onChange={(event) =>
                onInvoiceFormChange({ ...invoiceForm, amount_fiat: Number(event.target.value) })
              }
              min="0.00000001"
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
            <p>Мин. депозит: {selectedNetwork.min_deposit ?? "—"}</p>
            <p>Макс. депозит: {selectedNetwork.max_deposit ?? "—"}</p>
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
