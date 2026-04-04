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
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Создание платежа</p>
          <h2>Новый инвойс</h2>
        </div>
      </div>
      <form className="form" onSubmit={onCreateInvoice}>
        <label>
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

        <div className="form-grid form-grid-2">
          <label>
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
          <label>
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
        </div>

        <label>
          <span>Номер заказа</span>
          <input
            value={invoiceForm.merchant_order_id}
            onChange={(event) =>
              onInvoiceFormChange({ ...invoiceForm, merchant_order_id: event.target.value })
            }
            placeholder="order-001"
          />
        </label>

        <label>
          <span>Сумма в USD</span>
          <input
            value={invoiceForm.amount_fiat}
            onChange={(event) =>
              onInvoiceFormChange({ ...invoiceForm, amount_fiat: Number(event.target.value) })
            }
            min="1"
            type="number"
          />
        </label>

        {selectedNetwork ? (
          <div className="result-box hint-box">
            <p>
              Маршрут: {invoiceForm.crypto_currency} / {selectedNetwork.network}
            </p>
            <p>Мин. депозит: {selectedNetwork.min_deposit ?? "не указан"}</p>
            <p>Макс. депозит: {selectedNetwork.max_deposit ?? "не ограничен"}</p>
            <p>Сетевая комиссия: {selectedNetwork.network_fee ?? "не указана"}</p>
            <p>Memo/tag: {selectedNetwork.memo_required ? "требуется" : "не требуется"}</p>
          </div>
        ) : null}

        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Создаем..." : "Создать инвойс"}
        </button>
      </form>
    </article>
  );
}
