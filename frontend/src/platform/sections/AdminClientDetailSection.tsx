import { useEffect, useState } from "react";

import { CopyableIdentifier } from "../../components/CopyableIdentifier";
import { formatDecimal, formatMoneyAmount } from "../../utils/format";
import { invoiceCompactPillClass, invoiceStatusLabelRu } from "../../utils/invoiceStatus";
import { InvoiceStatusOverrideControl } from "../components/InvoiceStatusOverrideControl";
import {
  findTransactionForInvoice,
  invoiceCanAttemptSettlementRepair,
  invoiceNeedsSettlementRepair,
} from "../../utils/invoiceSettlementRepair";
import type {
  AccountingSummary,
  InvoiceAdminDetail,
  InvoiceItem,
  PayoutRequestItem,
  ProjectAdminUpdatePayload,
  ProviderEventItem,
  TenantAdminUpdatePayload,
  TenantDetailResponse,
  TransactionItem,
} from "../../api";
import { TenantPayoutsPanel } from "./TenantPayoutsPanel";
import { InvoiceTransactionDetailsCard } from "../../merchant/widgets/InvoiceTransactionDetailsCard";
import { ProviderEventList } from "../components/ProviderEventList";
import { ProjectApiUsagePanel } from "../components/ProjectApiUsagePanel";

type ClientDetailTab = "overview" | "profile" | "access" | "integration" | "traffic" | "ledger" | "invoice";

type AdminClientDetailSectionProps = {
  adminToken: string | null;
  loading: boolean;
  selectedTenantName: string;
  selectedTenantDetail: TenantDetailResponse | null;
  selectedTenantAccounting: AccountingSummary | null;
  selectedTenantInvoices: InvoiceItem[];
  selectedTenantTransactions: TransactionItem[];
  selectedTenantPayouts: PayoutRequestItem[];
  selectedInvoiceId: string | null;
  selectedInvoiceDetail: InvoiceAdminDetail | null;
  selectedInvoiceEvents: ProviderEventItem[];
  onBackToClients: () => void;
  onDeleteTenant: (tenantId: string) => void;
  onResetTenantOwnerPassword: (tenantId: string) => void;
  onResetTenantOwnerTwoFactor: (tenantId: string) => void;
  onAdminRegenerateApiKey: (apiKeyId: string) => void;
  onAdminRevokeApiKey: (apiKeyId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onUpdateAdminProject: (projectId: string, payload: ProjectAdminUpdatePayload) => void;
  onUpdateAdminTenant: (tenantId: string, payload: TenantAdminUpdatePayload) => void;
  onUpdateInvoiceStatus: (status: string) => void;
  onSyncInvoice: (invoiceId: string) => void;
  onRepairInvoiceSettlement: (invoiceId: string) => void;
  onApprovePayout: (payoutId: string) => void;
  onRejectPayout: (payoutId: string) => void;
  isSuperadmin?: boolean;
};

const DETAIL_TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: "overview", label: "Сводка" },
  { id: "profile", label: "Профиль" },
  { id: "access", label: "Доступ" },
  { id: "integration", label: "Проекты и API" },
  { id: "traffic", label: "Трафик API" },
  { id: "ledger", label: "Инвойсы и платежи" },
  { id: "invoice", label: "Карточка инвойса" },
];

export function AdminClientDetailSection({
  adminToken,
  loading,
  selectedTenantName,
  selectedTenantDetail,
  selectedTenantAccounting,
  selectedTenantInvoices,
  selectedTenantTransactions,
  selectedTenantPayouts,
  selectedInvoiceId,
  selectedInvoiceDetail,
  selectedInvoiceEvents,
  onBackToClients,
  onDeleteTenant,
  onResetTenantOwnerPassword,
  onResetTenantOwnerTwoFactor,
  onAdminRegenerateApiKey,
  onAdminRevokeApiKey,
  onSelectInvoice,
  onUpdateAdminProject,
  onUpdateAdminTenant,
  onUpdateInvoiceStatus,
  onSyncInvoice,
  onRepairInvoiceSettlement,
  onApprovePayout,
  onRejectPayout,
  isSuperadmin = false,
}: AdminClientDetailSectionProps) {
  const [tenantForm, setTenantForm] = useState<TenantAdminUpdatePayload | null>(null);
  const [projectForms, setProjectForms] = useState<Record<string, ProjectAdminUpdatePayload>>({});
  const [detailTab, setDetailTab] = useState<ClientDetailTab>("overview");

  useEffect(() => {
    if (!selectedTenantDetail) {
      setTenantForm(null);
      setProjectForms({});
      return;
    }
    setDetailTab("overview");
    setTenantForm({
      company_name: selectedTenantDetail.tenant?.name ?? "",
      slug: selectedTenantDetail.tenant?.slug ?? "",
      status: selectedTenantDetail.tenant?.status ?? "",
      review_comment: selectedTenantDetail.tenant?.review_comment ?? null,
      owner_email: selectedTenantDetail.owner?.email ?? "",
      owner_full_name: selectedTenantDetail.owner?.full_name ?? "",
      timezone: selectedTenantDetail.tenant?.timezone ?? "UTC",
      base_currency: selectedTenantDetail.tenant?.base_currency ?? "USD",
      plan: selectedTenantDetail.tenant?.plan ?? "free",
    });
    setProjectForms(
      Object.fromEntries(
        (selectedTenantDetail.projects ?? []).map((project) => [
          project.id,
          {
            name: project.name,
            domain: project.domain,
            description: project.description,
            webhook_url: project.webhook_url,
            checkout_delivery: project.checkout_delivery === "h2h" ? "h2h" : "payment_page",
            status: project.status,
          },
        ]),
      ),
    );
  }, [selectedTenantDetail]);

  useEffect(() => {
    if (selectedInvoiceId) {
      setDetailTab("invoice");
    }
  }, [selectedInvoiceId]);

  const selectedInvoiceTransaction = selectedInvoiceDetail
    ? findTransactionForInvoice(selectedTenantTransactions, selectedInvoiceDetail.id)
    : undefined;
  const showRepairSettlement =
    selectedInvoiceDetail !== null &&
    invoiceCanAttemptSettlementRepair(selectedInvoiceDetail, selectedInvoiceTransaction);
  const repairLooksMisconverted =
    selectedInvoiceDetail !== null &&
    invoiceNeedsSettlementRepair(selectedInvoiceDetail, selectedInvoiceTransaction);

  return (
    <section className="dashboard-grid client-grid">
      <article className="panel panel-span-2 pw-client-detail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Карточка клиента</p>
            <h2>{selectedTenantName}</h2>
          </div>
          <button className="ghost-button" onClick={onBackToClients} type="button">
            Назад к списку клиентов
          </button>
        </div>

        {!selectedTenantDetail ? (
          <p className="muted-text">Выберите клиента в разделе «Клиенты».</p>
        ) : (
          <div className="pw-client-detail-shell">
            <nav className="pw-console-tabs" role="tablist" aria-label="Раздел карточки клиента">
              {DETAIL_TABS.map((t) => (
                <button
                  aria-selected={detailTab === t.id}
                  className={`pw-console-tab ${detailTab === t.id ? "pw-console-tab-active" : ""}`}
                  key={t.id}
                  role="tab"
                  type="button"
                  onClick={() => setDetailTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="pw-console-tabpanels">
              {detailTab === "overview" ? (
                <div aria-label="Сводка" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Ключевые метрики по выбранному тенанту.</p>
                  <div className="detail-summary pw-readonly-kv-grid">
                    <CopyableIdentifier
                      label="Merchant ID"
                      value={selectedTenantDetail.tenant.id}
                      hint="UUID тенанта (tenant_id) для API и поддержки."
                      variant="chip"
                    />
                    <div className="detail-chip">
                      <span>Компания</span>
                      <strong>{selectedTenantDetail.tenant.name}</strong>
                    </div>
                    <div className="detail-chip">
                      <span>Статус</span>
                      <strong>{selectedTenantDetail.tenant.status}</strong>
                    </div>
                    <div className="detail-chip">
                      <span>Инвойсов</span>
                      <strong>{selectedTenantDetail.invoices_count}</strong>
                    </div>
                    <div className="detail-chip">
                      <span>Активных проектов</span>
                      <strong>{selectedTenantDetail.approved_projects_count}</strong>
                    </div>
                  </div>

                  {selectedTenantAccounting ? (
                    <div className="detail-summary pw-readonly-kv-grid">
                      <div className="detail-chip">
                        <span>Оплачено</span>
                        <strong>{formatDecimal(selectedTenantAccounting.invoices_paid_amount)}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Подтверждено</span>
                        <strong>{formatDecimal(selectedTenantAccounting.invoices_confirmed_amount)}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Чистая прибыль</span>
                        <strong>
                          {formatDecimal(
                            Number(selectedTenantAccounting.net_amount) +
                              Number(selectedTenantAccounting.total_platform_revenue_amount),
                          )}
                        </strong>
                      </div>
                      <div className="detail-chip">
                        <span>Выручка платформы</span>
                        <strong>{formatDecimal(selectedTenantAccounting.total_platform_revenue_amount)}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Средний чек</span>
                        <strong>{formatDecimal(selectedTenantAccounting.average_invoice_amount)}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="muted-text">Учётные суммы недоступны.</p>
                  )}
                </div>
              ) : null}

              {detailTab === "profile" ? (
                <div aria-label="Профиль" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Юридические и учётные поля клиента.</p>
                  <div className="detail-section pw-form-block">
                    {tenantForm ? (
                      <form
                        className="form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (selectedTenantDetail) {
                            onUpdateAdminTenant(selectedTenantDetail.tenant.id, tenantForm);
                          }
                        }}
                      >
                        <fieldset className="pw-fieldset">
                          <legend className="sr-only">Редактирование профиля клиента</legend>
                          <div className="pw-fieldset-cap">
                            <h3 className="pw-fieldset-title">Профиль и учётная запись</h3>
                            <p className="pw-fieldset-desc">
                              Название, slug и данные владельца сохраняются отдельно от операций ниже —
                              здесь только редактируемые поля.
                            </p>
                          </div>
                          <div className="pw-fieldset-body">
                            <CopyableIdentifier
                              className="panel-span-2"
                              label="Merchant ID"
                              value={selectedTenantDetail.tenant.id}
                              hint="Не редактируется. Передаётся в webhook и служебных интеграциях как tenant_id."
                            />
                            <div className="form-grid-2 pw-form-fields">
                          <label>
                            <span>Компания</span>
                            <input
                              value={tenantForm.company_name}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, company_name: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Slug</span>
                            <span className="pw-field-hint">Идентификатор URL, без пробелов.</span>
                            <input
                              value={tenantForm.slug}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, slug: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Email владельца</span>
                            <input
                              value={tenantForm.owner_email}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, owner_email: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Имя владельца</span>
                            <input
                              value={tenantForm.owner_full_name}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, owner_full_name: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Timezone</span>
                            <input
                              value={tenantForm.timezone}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, timezone: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Base currency</span>
                            <input
                              value={tenantForm.base_currency}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, base_currency: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Plan</span>
                            <input
                              value={tenantForm.plan}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, plan: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Status</span>
                            <input
                              value={tenantForm.status}
                              onChange={(event) =>
                                setTenantForm({ ...tenantForm, status: event.target.value })
                              }
                            />
                          </label>
                          <label className="panel-span-2">
                            <span>Комментарий</span>
                            <span className="pw-field-hint">Видим модератору и в истории статусов.</span>
                            <textarea
                              rows={3}
                              value={tenantForm.review_comment ?? ""}
                              onChange={(event) =>
                                setTenantForm({
                                  ...tenantForm,
                                  review_comment: event.target.value.trim() === "" ? null : event.target.value,
                                })
                              }
                            />
                          </label>
                            </div>
                            <div className="pw-form-actions">
                          <button className="primary-button" type="submit" disabled={loading}>
                            Сохранить клиента
                          </button>
                          <button
                            className="ghost-button danger-soft"
                            type="button"
                            onClick={() => selectedTenantDetail && onDeleteTenant(selectedTenantDetail.tenant.id)}
                          >
                            Удалить клиента
                          </button>
                            </div>
                          </div>
                        </fieldset>
                      </form>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {detailTab === "access" ? (
                <div aria-label="Доступ" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Учётная запись владельца и сбросы доступа.</p>
                  <div className="detail-section pw-form-block">
                    <div className="pw-fieldset">
                      <div className="pw-fieldset-cap">
                        <h3 className="pw-fieldset-title">Учётная запись владельца</h3>
                        <p className="pw-fieldset-desc">
                          Только чтение — сами учётные данные меняются в кабинете клиента или через сбросы ниже.
                        </p>
                      </div>
                      <div className="pw-fieldset-body">
                        <div className="pw-readonly-kv-grid">
                          <div className="detail-chip">
                            <span>Email</span>
                            <strong>{selectedTenantDetail?.owner?.email ?? "—"}</strong>
                          </div>
                          <div className="detail-chip">
                            <span>Владелец</span>
                            <strong>{selectedTenantDetail?.owner?.full_name ?? "—"}</strong>
                          </div>
                          <div className="detail-chip">
                            <span>Статус owner</span>
                            <strong>{selectedTenantDetail?.owner?.status ?? "—"}</strong>
                          </div>
                        </div>
                        <div className="pw-form-actions">
                          <button
                            className="primary-button"
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              selectedTenantDetail && onResetTenantOwnerPassword(selectedTenantDetail.tenant.id)
                            }
                          >
                            Сбросить пароль owner
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              selectedTenantDetail && onResetTenantOwnerTwoFactor(selectedTenantDetail.tenant.id)
                            }
                          >
                            Сбросить 2FA owner
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "integration" ? (
                <div aria-label="Интеграция" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Проекты, домены и API-ключи.</p>

                  <div className="detail-section">
                    <h3 className="pw-subsection-title">Проекты</h3>
                    <div className="tenant-list pw-tenant-cards-spaced">
                      {(selectedTenantDetail.projects ?? []).map((project) => (
                        <article className="tenant-card" key={project.id}>
                          {projectForms[project.id] ? (
                            <form
                              className="form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                onUpdateAdminProject(project.id, projectForms[project.id]);
                              }}
                            >
                              <fieldset className="pw-fieldset">
                                <legend className="sr-only">Проект {projectForms[project.id].name}</legend>
                                <div className="pw-fieldset-cap">
                                  <h4 className="pw-fieldset-title">{projectForms[project.id].name}</h4>
                                  <p className="pw-fieldset-desc">
                                    Настройки этого проекта: домен, статус, вебхук и публичное описание.
                                  </p>
                                </div>
                                <div className="pw-fieldset-body">
                              <div className="form-grid-2 pw-form-fields">
                                <label>
                                  <span>Название проекта</span>
                                  <input
                                    value={projectForms[project.id].name}
                                    onChange={(event) =>
                                      setProjectForms({
                                        ...projectForms,
                                        [project.id]: {
                                          ...projectForms[project.id],
                                          name: event.target.value,
                                        },
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Домен</span>
                                  <input
                                    value={projectForms[project.id].domain}
                                    onChange={(event) =>
                                      setProjectForms({
                                        ...projectForms,
                                        [project.id]: {
                                          ...projectForms[project.id],
                                          domain: event.target.value,
                                        },
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Формат checkout</span>
                                  <span className="pw-field-hint">
                                    Платёжная ссылка или H2H-реквизиты в API. Меняет только администратор.
                                  </span>
                                  <select
                                    value={projectForms[project.id].checkout_delivery}
                                    onChange={(event) =>
                                      setProjectForms({
                                        ...projectForms,
                                        [project.id]: {
                                          ...projectForms[project.id],
                                          checkout_delivery: event.target.value as ProjectAdminUpdatePayload["checkout_delivery"],
                                        },
                                      })
                                    }
                                  >
                                    <option value="payment_page">Платёжная ссылка (/pay/…)</option>
                                    <option value="h2h">H2H (адрес + QR в API)</option>
                                  </select>
                                </label>
                                <label>
                                  <span>Status</span>
                                  <input
                                    value={projectForms[project.id].status}
                                    onChange={(event) =>
                                      setProjectForms({
                                        ...projectForms,
                                        [project.id]: {
                                          ...projectForms[project.id],
                                          status: event.target.value,
                                        },
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Webhook URL</span>
                                  <span className="pw-field-hint">Пустое значение отключает доставку событий на URL.</span>
                                  <input
                                    value={projectForms[project.id].webhook_url ?? ""}
                                    onChange={(event) =>
                                      setProjectForms({
                                        ...projectForms,
                                        [project.id]: {
                                          ...projectForms[project.id],
                                          webhook_url:
                                            event.target.value.trim() === "" ? null : event.target.value,
                                        },
                                      })
                                    }
                                  />
                                </label>
                                <label className="panel-span-2">
                                  <span>Описание</span>
                                  <textarea
                                    rows={3}
                                    value={projectForms[project.id].description ?? ""}
                                    onChange={(event) =>
                                      setProjectForms({
                                        ...projectForms,
                                        [project.id]: {
                                          ...projectForms[project.id],
                                          description:
                                            event.target.value.trim() === "" ? null : event.target.value,
                                        },
                                      })
                                    }
                                  />
                                </label>
                              </div>
                              <div className="pw-form-actions">
                                <span className="muted-text">
                                  {project.has_webhook_secret ? "Webhook secret: задан" : "Webhook secret: нет"}
                                </span>
                                <button className="primary-button" type="submit" disabled={loading}>
                                  Сохранить проект
                                </button>
                              </div>
                                </div>
                              </fieldset>
                            </form>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3 className="pw-subsection-title">API-ключи</h3>
                    <div className="tenant-list pw-tenant-cards-spaced">
                      {selectedTenantDetail.api_keys.length === 0 ? (
                        <p className="muted-text">Ключи еще не выданы.</p>
                      ) : (
                        selectedTenantDetail.api_keys.map((apiKey) => (
                          <article className="tenant-card" key={apiKey.id}>
                            <div>
                              <strong>{apiKey.public_key}</strong>
                            </div>
                            <div className="tenant-meta">
                              <span>{apiKey.status}</span>
                              <button
                                className="ghost-button"
                                onClick={() => onAdminRegenerateApiKey(apiKey.id)}
                                type="button"
                              >
                                Перевыпустить
                              </button>
                              <button
                                className="ghost-button"
                                onClick={() => onAdminRevokeApiKey(apiKey.id)}
                                type="button"
                              >
                                Отозвать
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "traffic" ? (
                <div aria-label="Трафик API" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">
                    Счётчики входящих запросов к Merchant API, платёжной странице, webhook Crypto-Cash,
                    исходящих вызовов к Crypto-Cash и доставки webhook мерчанту. Данные хранятся до 45 дней.
                  </p>
                  {!adminToken ? (
                    <p className="muted-text">Нет сессии администратора для загрузки статистики.</p>
                  ) : (
                    <div className="tenant-list pw-tenant-cards-spaced">
                      {(selectedTenantDetail.projects ?? []).length === 0 ? (
                        <p className="muted-text">У клиента пока нет проектов.</p>
                      ) : (
                        (selectedTenantDetail.projects ?? []).map((project) => (
                          <ProjectApiUsagePanel
                            key={project.id}
                            projectId={project.id}
                            projectName={project.name}
                            token={adminToken}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {detailTab === "ledger" ? (
                <div aria-label="Движения" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">
                    Инвойсы, транзакции и заявки на вывод. Для карточки инвойса нажмите «Детали».
                  </p>

                  <div className="detail-section">
                    <h4 className="pw-subheading">Инвойсы клиента</h4>
                    <div className="tenant-list pw-tenant-cards-compact">
                      {selectedTenantInvoices.length === 0 ? (
                        <p className="muted-text">Инвойсов пока нет.</p>
                      ) : (
                        selectedTenantInvoices.map((invoice) => (
                          <article
                            className={`tenant-card ${selectedInvoiceId === invoice.id ? "tenant-card-active" : ""}`}
                            key={invoice.id}
                          >
                            <div>
                              <strong>{invoice.merchant_order_id}</strong>
                              <p>
                                {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency} /{" "}
                                {formatDecimal(invoice.amount_crypto)} {invoice.crypto_currency}
                              </p>
                              <p className="muted-text truncate-address">{invoice.payment_address}</p>
                            </div>
                            <div className="tenant-meta">
                              <span>{invoice.network}</span>
                              <span className={invoiceCompactPillClass(invoice.status)}>
                                {invoiceStatusLabelRu(invoice.status)}
                              </span>
                              <button
                                className="ghost-button"
                                onClick={() => onSelectInvoice(invoice.id)}
                                type="button"
                              >
                                Детали и статусы →
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4 className="pw-subheading">Транзакции клиента</h4>
                    <div className="tenant-list pw-tenant-cards-compact">
                      {selectedTenantTransactions.length === 0 ? (
                        <p className="muted-text">Транзакций пока нет.</p>
                      ) : (
                        selectedTenantTransactions.map((transaction) => (
                          <article className="tenant-card" key={transaction.id}>
                            <div>
                              <strong>{formatMoneyAmount(transaction.gross_amount, transaction.currency)}</strong>
                              <p className="muted-text">Invoice: {transaction.invoice_id}</p>
                              <p className="muted-text">
                                Fees: provider {formatDecimal(transaction.provider_fee)} · platform{" "}
                                {formatDecimal(transaction.platform_fee)}
                              </p>
                            </div>
                            <div className="tenant-meta">
                              <span>{transaction.status}</span>
                              <span>{transaction.paid_at ?? "Не оплачено"}</span>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>

                  <TenantPayoutsPanel
                    loading={loading}
                    payouts={selectedTenantPayouts}
                    onApprove={onApprovePayout}
                    onReject={onRejectPayout}
                  />
                </div>
              ) : null}

              {detailTab === "invoice" ? (
                <div aria-label="Инвойс" className="pw-console-tabpanel" role="tabpanel">
                  {!selectedInvoiceDetail ? (
                    <p className="muted-text pw-tabpanel-intro">
                      Выберите инвойс на вкладке «Инвойсы и платежи», затем вернитесь сюда.
                    </p>
                  ) : (
                    <>
                      <p className="muted-text pw-tabpanel-intro">
                        Ручное изменение статуса и технические данные провайдера.
                      </p>
                      <div className="detail-summary">
                        <div className="detail-chip">
                          <span>Статус</span>
                          <strong>{invoiceStatusLabelRu(selectedInvoiceDetail.status)}</strong>
                        </div>
                        <div className="detail-chip">
                          <span>Сумма</span>
                          <strong>
                            {formatDecimal(selectedInvoiceDetail.amount_fiat)}{" "}
                            {selectedInvoiceDetail.fiat_currency}
                          </strong>
                        </div>
                        <div className="detail-chip">
                          <span>Криптосумма</span>
                          <strong>
                            {formatDecimal(selectedInvoiceDetail.amount_crypto)}{" "}
                            {selectedInvoiceDetail.crypto_currency}
                          </strong>
                        </div>
                        <div className="detail-chip">
                          <span>Сеть</span>
                          <strong>{selectedInvoiceDetail.network}</strong>
                        </div>
                        {selectedInvoiceDetail.transaction_details?.exchange_rate ? (
                          <div className="detail-chip">
                            <span>Курс settlement</span>
                            <strong>
                              {formatDecimal(selectedInvoiceDetail.transaction_details.exchange_rate, {
                                maxFractionDigits: 8,
                              })}{" "}
                              {selectedInvoiceDetail.transaction_details.exchange_rate_currency}
                            </strong>
                          </div>
                        ) : null}
                      </div>
                      {selectedInvoiceDetail.transaction_details ? (
                        <InvoiceTransactionDetailsCard
                          compact
                          details={selectedInvoiceDetail.transaction_details}
                        />
                      ) : null}
                      <div className="result-box">
                        <p>Invoice ID: {selectedInvoiceDetail.id}</p>
                        <p>Provider order: {selectedInvoiceDetail.provider_order_id}</p>
                        <p>Адрес оплаты: {selectedInvoiceDetail.payment_address}</p>
                        <p>Создан: {selectedInvoiceDetail.created_at}</p>
                        <p>Оплачен: {selectedInvoiceDetail.paid_at ?? "Еще нет"}</p>
                        <p>Подтвержден: {selectedInvoiceDetail.confirmed_at ?? "Еще нет"}</p>
                      </div>
                      {repairLooksMisconverted ? (
                        <p className="muted-text pw-repair-hint">
                          Обнаружена ошибка учёта: gross в USDT совпадает с суммой в{" "}
                          {selectedInvoiceDetail.crypto_currency}. Нажмите «Пересчитать settlement» — gross и
                          комиссии будут пересчитаны по курсу.
                        </p>
                      ) : showRepairSettlement ? (
                        <p className="muted-text pw-repair-hint">
                          Оплаченный altcoin-инвойс: при необходимости можно пересчитать settlement в USDT по
                          текущему курсу.
                        </p>
                      ) : null}
                      <div className="action-row-inline pw-action-strip">
                        <button
                          className="ghost-button"
                          disabled={loading}
                          onClick={() => onSyncInvoice(selectedInvoiceDetail.id)}
                          type="button"
                        >
                          Синхронизировать
                        </button>
                        {showRepairSettlement ? (
                          <button
                            className="ghost-button danger-soft"
                            disabled={loading}
                            onClick={() => onRepairInvoiceSettlement(selectedInvoiceDetail.id)}
                            type="button"
                          >
                            Пересчитать settlement
                          </button>
                        ) : null}
                      </div>
                      {isSuperadmin ? (
                        <InvoiceStatusOverrideControl
                          currentStatus={selectedInvoiceDetail.status}
                          disabled={loading}
                          onApply={onUpdateInvoiceStatus}
                        />
                      ) : (
                        <p className="muted-text pw-tabpanel-intro">
                          Ручная смена статуса доступна только superadmin.
                        </p>
                      )}
                      <div className="result-box">
                        <strong>Raw provider payload</strong>
                        <pre className="json-box">{JSON.stringify(selectedInvoiceDetail.raw_provider_payload_json, null, 2)}</pre>
                      </div>
                      <div className="result-box">
                        <strong>События Crypto-Cash по инвойсу</strong>
                        <ProviderEventList compact events={selectedInvoiceEvents} />
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
