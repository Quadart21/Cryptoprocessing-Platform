import { useMemo, useState } from "react";

import type {
  InvoiceAdminDetail,
  InvoiceItem,
  PayoutRequestItem,
  ProjectItem,
  ProviderEventItem,
  TransactionItem,
} from "../../../api";
import { ClientCardTraffic } from "./ClientCardTraffic";
import { formatDecimal, formatMoneyAmount } from "../../../utils/format";
import { invoiceCompactPillClass, invoiceStatusLabelRu } from "../../../utils/invoiceStatus";
import { findTransactionForInvoice } from "../../../utils/invoiceSettlementRepair";
import { TenantPayoutsPanel } from "../TenantPayoutsPanel";
import { ClientCardInvoice } from "./ClientCardInvoice";
import { formatWhen } from "./model";

export type ClientOpsView = "invoices" | "transactions" | "payouts" | "traffic";
type InvoiceFilter = "all" | "open" | "paid" | "problem";

const INVOICE_FILTERS: Array<{ id: InvoiceFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "open", label: "В работе" },
  { id: "paid", label: "Оплачены" },
  { id: "problem", label: "Проблемные" },
];

type ClientCardOperationsProps = {
  adminToken: string | null;
  events: ProviderEventItem[];
  invoice: InvoiceAdminDetail | null;
  invoiceFocus: boolean;
  invoices: InvoiceItem[];
  isSuperadmin: boolean;
  loading: boolean;
  payouts: PayoutRequestItem[];
  projects: ProjectItem[];
  selectedInvoiceId: string | null;
  tenantId: string;
  transactions: TransactionItem[];
  view: ClientOpsView;
  onApprovePayout: (payoutId: string) => void;
  onInvoiceFocus: (focused: boolean) => void;
  onRejectPayout: (payoutId: string) => void;
  onRepairInvoice: (invoiceId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onSyncInvoice: (invoiceId: string) => void;
  onUpdateInvoiceStatus: (status: string) => void;
  onViewChange: (view: ClientOpsView) => void;
};

export function ClientCardOperations(props: ClientCardOperationsProps) {
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("all");
  const [txQuery, setTxQuery] = useState("");
  const projectName = useMemo(() => {
    const map = new Map(props.projects.map((project) => [project.id, project.name]));
    return (projectId: string) => map.get(projectId) ?? "";
  }, [props.projects]);

  const filteredInvoices = useMemo(
    () => props.invoices.filter((invoice) => matchInvoice(invoice, invoiceQuery, invoiceFilter, projectName(invoice.project_id))),
    [invoiceFilter, invoiceQuery, projectName, props.invoices],
  );
  const filteredTransactions = useMemo(
    () => props.transactions.filter((transaction) => matchTransaction(transaction, txQuery)),
    [props.transactions, txQuery],
  );

  const detailReady = props.invoice !== null && props.invoice.id === props.selectedInvoiceId;
  const transaction = detailReady && props.invoice ? findTransactionForInvoice(props.transactions, props.invoice.id) : undefined;

  return (
    <div className="cc-stack">
      <div className="cc-toolbar">
        <div className="segment-row cc-segments" role="tablist" aria-label="Операции клиента">
          <Segment active={props.view === "invoices"} count={props.invoices.length} label="Инвойсы" onClick={() => props.onViewChange("invoices")} />
          <Segment
            active={props.view === "transactions"}
            count={props.transactions.length}
            label="Транзакции"
            onClick={() => props.onViewChange("transactions")}
          />
          <Segment active={props.view === "payouts"} count={props.payouts.length} label="Выводы" onClick={() => props.onViewChange("payouts")} />
          <Segment active={props.view === "traffic"} label="Трафик" onClick={() => props.onViewChange("traffic")} />
        </div>
        {props.view === "invoices" || props.view === "transactions" ? (
          <label className="pw-search-field">
            <span className="sr-only">Поиск</span>
            <input
              className="pw-search-input"
              onChange={(event) =>
                props.view === "invoices" ? setInvoiceQuery(event.target.value) : setTxQuery(event.target.value)
              }
              placeholder={props.view === "invoices" ? "Заказ, адрес, сеть, статус…" : "Инвойс, статус, сумма…"}
              type="search"
              value={props.view === "invoices" ? invoiceQuery : txQuery}
            />
          </label>
        ) : null}
      </div>

      {props.view === "invoices" ? (
        <div className="cc-stack">
          <div className="cc-filters" role="toolbar" aria-label="Фильтр инвойсов">
            {INVOICE_FILTERS.map((filter) => (
              <button
                aria-pressed={invoiceFilter === filter.id}
                className={`segment-button ${invoiceFilter === filter.id ? "segment-button-active" : ""}`}
                key={filter.id}
                onClick={() => setInvoiceFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
            <span className="cc-hint">
              {filteredInvoices.length} из {props.invoices.length}
            </span>
          </div>
          {filteredInvoices.length === 0 ? (
            <div className="cc-empty">
              <p>{props.invoices.length === 0 ? "Инвойсов пока нет." : "Ничего не найдено."}</p>
              {props.invoices.length > 0 ? (
                <button
                  className="ghost-button"
                  onClick={() => {
                    setInvoiceQuery("");
                    setInvoiceFilter("all");
                  }}
                  type="button"
                >
                  Сбросить фильтр
                </button>
              ) : null}
            </div>
          ) : (
            <div className={`cc-split ${props.invoiceFocus ? "cc-split-focus" : ""}`}>
              <div className="cc-split-list">
                {filteredInvoices.map((invoice) => {
                  const active = props.selectedInvoiceId === invoice.id;
                  return (
                    <button
                      aria-current={active ? "true" : undefined}
                      className={`cc-row ${active ? "cc-row-active" : ""}`}
                      id={`cc-invoice-${invoice.id}`}
                      key={invoice.id}
                      onClick={() => {
                        props.onInvoiceFocus(true);
                        props.onSelectInvoice(invoice.id);
                      }}
                      type="button"
                    >
                      <span className="cc-row-title">{invoice.merchant_order_id}</span>
                      <span className={invoiceCompactPillClass(invoice.status)}>{invoiceStatusLabelRu(invoice.status)}</span>
                      <span className="cc-row-sub">
                        {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency} / {formatDecimal(invoice.amount_crypto)}{" "}
                        {invoice.crypto_currency} · {invoice.network}
                      </span>
                      <span className="cc-row-sub cc-ellipsis">{invoice.payment_address || projectName(invoice.project_id) || "—"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="cc-split-detail">
                {detailReady && props.invoice ? (
                  <ClientCardInvoice
                    events={props.events}
                    invoice={props.invoice}
                    isSuperadmin={props.isSuperadmin}
                    loading={props.loading}
                    onBack={() => props.onInvoiceFocus(false)}
                    onRepair={props.onRepairInvoice}
                    onSync={props.onSyncInvoice}
                    onUpdateStatus={props.onUpdateInvoiceStatus}
                    projects={props.projects}
                    transaction={transaction}
                  />
                ) : props.selectedInvoiceId ? (
                  <p className="cc-empty">Загружаем инвойс…</p>
                ) : (
                  <p className="cc-empty">Выберите инвойс в списке слева.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {props.view === "transactions" ? (
        filteredTransactions.length === 0 ? (
          <div className="cc-empty">
            <p>{props.transactions.length === 0 ? "Транзакций пока нет." : "Ничего не найдено."}</p>
          </div>
        ) : (
          <div className="cc-list">
            {filteredTransactions.map((transaction) => (
              <button
                className="cc-row"
                key={transaction.id}
                onClick={() => {
                  props.onViewChange("invoices");
                  props.onInvoiceFocus(true);
                  props.onSelectInvoice(transaction.invoice_id);
                }}
                type="button"
              >
                <span className="cc-row-title">{formatMoneyAmount(transaction.gross_amount, transaction.currency)}</span>
                <span className={`cc-pill cc-pill-${transactionTone(transaction.status)}`}>{transaction.status}</span>
                <span className="cc-row-sub">
                  Нетто {formatMoneyAmount(transaction.net_amount, transaction.currency)} · провайдер{" "}
                  {formatDecimal(transaction.provider_fee)} · платформа {formatDecimal(transaction.platform_fee)}
                </span>
                <span className="cc-row-sub cc-ellipsis">
                  Инвойс {transaction.invoice_id} · {formatWhen(transaction.paid_at ?? transaction.created_at)}
                </span>
              </button>
            ))}
          </div>
        )
      ) : null}

      {props.view === "payouts" ? (
        <TenantPayoutsPanel
          loading={props.loading}
          onApprove={props.onApprovePayout}
          onReject={props.onRejectPayout}
          payouts={props.payouts}
        />
      ) : null}

      {props.view === "traffic" ? (
        !props.adminToken ? (
          <p className="cc-empty">Нет сессии администратора для загрузки статистики.</p>
        ) : (
          <ClientCardTraffic projects={props.projects} tenantId={props.tenantId} token={props.adminToken} />
        )
      ) : null}
    </div>
  );
}

function Segment({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count?: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`segment-button ${active ? "segment-button-active" : ""}`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
      {count !== undefined ? <span className="cc-tab-count">{count}</span> : null}
    </button>
  );
}

function transactionTone(status: string): "ok" | "wait" | "bad" | "muted" {
  const value = status.trim().toLowerCase();
  if (value === "paid" || value === "confirmed" || value === "completed") return "ok";
  if (value === "pending" || value === "confirming" || value === "processing") return "wait";
  if (value === "failed" || value === "cancelled" || value === "expired") return "bad";
  return "muted";
}

function matchInvoice(invoice: InvoiceItem, query: string, filter: InvoiceFilter, project: string): boolean {
  const status = invoice.status.trim().toLowerCase();
  if (filter === "open" && status !== "pending" && status !== "confirming") return false;
  if (filter === "paid" && status !== "paid" && status !== "confirmed") return false;
  if (
    filter === "problem" &&
    status !== "expired" &&
    status !== "cancelled" &&
    status !== "failed" &&
    status !== "aml_frozen"
  ) {
    return false;
  }
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    invoice.merchant_order_id,
    invoice.id,
    invoice.payment_address,
    invoice.provider_order_id,
    invoice.network,
    invoice.crypto_currency,
    invoice.fiat_currency,
    invoice.status,
    invoiceStatusLabelRu(invoice.status),
    project,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchTransaction(transaction: TransactionItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    transaction.id,
    transaction.invoice_id,
    transaction.status,
    transaction.currency,
    transaction.gross_amount,
    transaction.net_amount,
    transaction.crypto_currency,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}
