import { useState } from "react";

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
import { ClientCardHeader } from "./client-card/ClientCardHeader";
import { ClientCardOperations, type ClientOpsView } from "./client-card/ClientCardOperations";
import { ClientCardOverview } from "./client-card/ClientCardOverview";
import { ClientCardProfile } from "./client-card/ClientCardProfile";
import { ClientCardProjects } from "./client-card/ClientCardProjects";
import { projectPayloadFromProject, tenantPayloadFromDetail } from "./client-card/model";

type ClientCardTab = "overview" | "profile" | "projects" | "operations";

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

function formsFromDetail(detail: TenantDetailResponse | null): Record<string, ProjectAdminUpdatePayload> {
  return Object.fromEntries((detail?.projects ?? []).map((project) => [project.id, projectPayloadFromProject(project)]));
}

const TABS: Array<{ id: ClientCardTab; label: string }> = [
  { id: "overview", label: "Сводка" },
  { id: "profile", label: "Профиль" },
  { id: "projects", label: "Проекты" },
  { id: "operations", label: "Операции" },
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
  const [syncedDetail, setSyncedDetail] = useState(selectedTenantDetail);
  const [tenantForm, setTenantForm] = useState<TenantAdminUpdatePayload | null>(() =>
    selectedTenantDetail ? tenantPayloadFromDetail(selectedTenantDetail) : null,
  );
  const [projectForms, setProjectForms] = useState<Record<string, ProjectAdminUpdatePayload>>(() =>
    formsFromDetail(selectedTenantDetail),
  );
  const [tab, setTab] = useState<ClientCardTab>("overview");
  const [opsView, setOpsView] = useState<ClientOpsView>("invoices");
  const [invoiceFocus, setInvoiceFocus] = useState(false);
  const [seenTenantId, setSeenTenantId] = useState(selectedTenantDetail?.tenant.id ?? null);
  const tenantId = selectedTenantDetail?.tenant.id ?? null;
  const pendingPayouts = selectedTenantPayouts.filter((payout) => payout.status === "pending_review").length;

  if (selectedTenantDetail !== syncedDetail) {
    setSyncedDetail(selectedTenantDetail);
    setTenantForm(selectedTenantDetail ? tenantPayloadFromDetail(selectedTenantDetail) : null);
    setProjectForms(formsFromDetail(selectedTenantDetail));
  }

  if (tenantId !== seenTenantId) {
    setSeenTenantId(tenantId);
    setTab("overview");
    setOpsView("invoices");
    setInvoiceFocus(false);
  }

  function openInvoice(invoiceId: string) {
    setTab("operations");
    setOpsView("invoices");
    setInvoiceFocus(true);
    onSelectInvoice(invoiceId);
  }

  function openOps(view: ClientOpsView) {
    setTab("operations");
    setOpsView(view);
    if (view !== "invoices") setInvoiceFocus(false);
  }

  function patchTenant(patch: Partial<TenantAdminUpdatePayload>) {
    setTenantForm((current) => (current ? { ...current, ...patch } : current));
  }

  function patchProject(projectId: string, patch: Partial<ProjectAdminUpdatePayload>) {
    setProjectForms((current) => {
      const previous = current[projectId];
      if (!previous) return current;
      return { ...current, [projectId]: { ...previous, ...patch } };
    });
  }

  function submitTenant() {
    if (!selectedTenantDetail || !tenantForm) return;
    onUpdateAdminTenant(selectedTenantDetail.tenant.id, {
      ...tenantForm,
      company_name: tenantForm.company_name.trim(),
      slug: tenantForm.slug.trim(),
      status: tenantForm.status.trim(),
      owner_email: tenantForm.owner_email.trim(),
      owner_full_name: tenantForm.owner_full_name.trim(),
      timezone: tenantForm.timezone.trim(),
      base_currency: tenantForm.base_currency.trim(),
      plan: tenantForm.plan.trim(),
    });
  }

  function confirmDelete() {
    if (!selectedTenantDetail) return;
    const name = selectedTenantDetail.tenant.name || selectedTenantName;
    const confirmed = window.confirm(
      `Удалить клиента «${name}»? Если есть инвойсы, активные проекты, выводы или баланс, сервер отклонит удаление — тогда заблокируйте клиента.`,
    );
    if (!confirmed) return;
    onDeleteTenant(selectedTenantDetail.tenant.id);
  }

  function confirmResetPassword() {
    if (!tenantId) return;
    const confirmed = window.confirm(
      "Сбросить пароль владельца? Текущий пароль перестанет работать, новый появится в уведомлении.",
    );
    if (!confirmed) return;
    onResetTenantOwnerPassword(tenantId);
  }

  function confirmResetTwoFactor() {
    if (!tenantId) return;
    const confirmed = window.confirm("Сбросить 2FA владельца? Вход по второму фактору будет отключён.");
    if (!confirmed) return;
    onResetTenantOwnerTwoFactor(tenantId);
  }

  function confirmRegenerateKey(apiKeyId: string) {
    const key = selectedTenantDetail?.api_keys.find((item) => item.id === apiKeyId);
    const confirmed = window.confirm(
      `Перевыпустить ключ ${key?.public_key ?? ""}? Старый секрет перестанет работать. Новый секрет появится в уведомлении.`,
    );
    if (!confirmed) return;
    onAdminRegenerateApiKey(apiKeyId);
  }

  function confirmRevokeKey(apiKeyId: string) {
    const key = selectedTenantDetail?.api_keys.find((item) => item.id === apiKeyId);
    const confirmed = window.confirm(
      `Отозвать ключ ${key?.public_key ?? ""}? Запросы с этим ключом перестанут проходить.`,
    );
    if (!confirmed) return;
    onAdminRevokeApiKey(apiKeyId);
  }

  return (
    <section className="dashboard-grid client-grid cc-page">
      <article className="panel panel-span-2 cc-panel">
        {!selectedTenantDetail || !tenantForm ? (
          <div className="cc-empty-state">
            <h2>{loading ? "Загружаем карточку" : "Клиент не выбран"}</h2>
            <p>{loading ? "Подтягиваем профиль, проекты и операции." : "Откройте клиента в разделе «Клиенты»."}</p>
            <button className="ghost-button" onClick={onBackToClients} type="button">
              К списку клиентов
            </button>
          </div>
        ) : (
          <>
            <ClientCardHeader
              accounting={selectedTenantAccounting}
              detail={selectedTenantDetail}
              fallbackName={selectedTenantName}
              onBack={onBackToClients}
            />
            <nav aria-label="Разделы карточки клиента" className="cc-nav" role="tablist">
              {TABS.map((item) => (
                <button
                  aria-selected={tab === item.id}
                  className={`cc-tab ${tab === item.id ? "cc-tab-active" : ""}`}
                  id={`cc-tab-${item.id}`}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  role="tab"
                  type="button"
                >
                  {item.label}
                  {item.id === "projects" ? (
                    <span className="cc-tab-count">{selectedTenantDetail.projects?.length ?? 0}</span>
                  ) : null}
                  {item.id === "operations" && pendingPayouts > 0 ? (
                    <span className="cc-tab-badge">{pendingPayouts}</span>
                  ) : null}
                </button>
              ))}
            </nav>
            <div
              aria-labelledby={`cc-tab-${tab}`}
              className="cc-body"
              id={`cc-panel-${tab}`}
              role="tabpanel"
            >
              {tab === "overview" ? (
                <ClientCardOverview
                  accounting={selectedTenantAccounting}
                  detail={selectedTenantDetail}
                  invoices={selectedTenantInvoices}
                  loading={loading}
                  onOpenInvoice={openInvoice}
                  onOpenInvoices={() => openOps("invoices")}
                  onOpenPayouts={() => openOps("payouts")}
                  onOpenProjects={() => setTab("projects")}
                  onResetPassword={confirmResetPassword}
                  onResetTwoFactor={confirmResetTwoFactor}
                  payouts={selectedTenantPayouts}
                />
              ) : null}
              {tab === "profile" ? (
                <ClientCardProfile
                  detail={selectedTenantDetail}
                  form={tenantForm}
                  loading={loading}
                  onDelete={confirmDelete}
                  onPatch={patchTenant}
                  onResetPassword={confirmResetPassword}
                  onResetTwoFactor={confirmResetTwoFactor}
                  onSubmit={submitTenant}
                />
              ) : null}
              {tab === "projects" ? (
                <ClientCardProjects
                  apiKeys={selectedTenantDetail.api_keys ?? []}
                  loading={loading}
                  onPatchProject={patchProject}
                  onRegenerateKey={confirmRegenerateKey}
                  onRevokeKey={confirmRevokeKey}
                  onSaveProject={(projectId) => {
                    const payload = projectForms[projectId];
                    if (!payload) return;
                    onUpdateAdminProject(projectId, {
                      ...payload,
                      name: payload.name.trim(),
                      domain: payload.domain.trim(),
                      status: payload.status.trim(),
                    });
                  }}
                  projectForms={projectForms}
                  projects={selectedTenantDetail.projects ?? []}
                  tenantId={selectedTenantDetail.tenant.id}
                />
              ) : null}
              {tab === "operations" ? (
                <ClientCardOperations
                  adminToken={adminToken}
                  events={selectedInvoiceEvents}
                  invoice={selectedInvoiceDetail}
                  invoiceFocus={invoiceFocus}
                  invoices={selectedTenantInvoices}
                  isSuperadmin={isSuperadmin}
                  loading={loading}
                  onApprovePayout={onApprovePayout}
                  onInvoiceFocus={setInvoiceFocus}
                  onRejectPayout={onRejectPayout}
                  onRepairInvoice={onRepairInvoiceSettlement}
                  onSelectInvoice={onSelectInvoice}
                  onSyncInvoice={onSyncInvoice}
                  onUpdateInvoiceStatus={onUpdateInvoiceStatus}
                  onViewChange={openOps}
                  payouts={selectedTenantPayouts}
                  projects={selectedTenantDetail.projects ?? []}
                  selectedInvoiceId={selectedInvoiceId}
                  tenantId={selectedTenantDetail.tenant.id}
                  transactions={selectedTenantTransactions}
                  view={opsView}
                />
              ) : null}
            </div>
          </>
        )}
      </article>
    </section>
  );
}
