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
    <article className="panel invoice-create-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Создание платежа</p>
          <h2>Новый инвойс</h2>
          <p className="invoice-create-subtitle">
            Выставите счет в выбранном токене и сразу получите платежные реквизиты.
          </p>
        </div>
      </div>
      <form className="form invoice-create-form" onSubmit={onCreateInvoice}>
        <div className="invoice-create-grid">
          <label className="invoice-create-field invoice-create-field-wide">
            <span>Проект</span>
            <small>К какому проекту относится платеж</small>
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

          <label className="invoice-create-field">
            <span>Токен</span>
            <small>Актив, который оплатит клиент</small>
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

          <label className="invoice-create-field">
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

          <label className="invoice-create-field">
            <span>Номер заказа</span>
            <small>Ваш внутренний идентификатор платежа</small>
            <input
              value={invoiceForm.merchant_order_id}
              onChange={(event) =>
                onInvoiceFormChange({ ...invoiceForm, merchant_order_id: event.target.value })
              }
              placeholder="order-001"
            />
          </label>

          <label className="invoice-create-field">
            <span>Сумма в токене</span>
            <small>
              Сумма платежа в выбранном токене; эквивалент в USD/USDT считается в панели отдельно
            </small>
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
          <div className="result-box hint-box invoice-create-hint">
            <div className="invoice-create-hint-head">
              <strong>
                {invoiceForm.crypto_currency} / {selectedNetwork.network}
              </strong>
              <span>Проверьте маршрут перед созданием инвойса</span>
            </div>
            <div className="invoice-create-hint-grid">
              <p>Инвойс создается в токене, а учетный эквивалент в системе считается по курсу.</p>
              <p>Мин. депозит: {selectedNetwork.min_deposit ?? "не указан"}</p>
              <p>Макс. депозит: {selectedNetwork.max_deposit ?? "не ограничен"}</p>
              <p>Сетевая комиссия: {selectedNetwork.network_fee ?? "не указана"}</p>
              <p>Memo/tag: {selectedNetwork.memo_required ? "требуется" : "не требуется"}</p>
            </div>
          </div>
        ) : null}

        <div className="invoice-create-actions">
          <button className="primary-button" disabled={!canSubmit} type="submit">
            {loading ? "Создаем..." : "Создать инвойс"}
          </button>
        </div>
      </form>
    </article>
  );
}
