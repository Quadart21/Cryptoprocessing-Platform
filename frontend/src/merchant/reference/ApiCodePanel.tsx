import { useMemo, useState } from "react";

import { useApiTranslation } from "../../i18n";

type ApiCodeTab = "request" | "success" | "error";

type ApiCodePanelProps = {
  endpointId: string;
  requestExample?: string;
  successExample: string;
  errorExample: string;
  onCopy: (value: string, label: string) => void | Promise<void>;
};

const TAB_BADGES: Record<ApiCodeTab, { badge: string; tone: string }> = {
  request: { badge: "REQ", tone: "request" },
  success: { badge: "2xx", tone: "success" },
  error: { badge: "4xx", tone: "error" },
};

export function ApiCodePanel({
  endpointId,
  requestExample,
  successExample,
  errorExample,
  onCopy,
}: ApiCodePanelProps) {
  const { t } = useApiTranslation();

  const tabMeta = useMemo(
    () => ({
      request: { label: t("merchant.apiDocs.codePanel.request"), ...TAB_BADGES.request },
      success: { label: t("merchant.apiDocs.codePanel.success"), ...TAB_BADGES.success },
      error: { label: t("merchant.apiDocs.codePanel.error"), ...TAB_BADGES.error },
    }),
    [t],
  );

  const tabs = useMemo(() => {
    const items: Array<{ id: ApiCodeTab; code: string }> = [];
    if (requestExample?.trim()) {
      items.push({ id: "request", code: requestExample });
    }
    if (successExample?.trim()) {
      items.push({ id: "success", code: successExample });
    }
    if (errorExample?.trim()) {
      items.push({ id: "error", code: errorExample });
    }
    return items;
  }, [errorExample, requestExample, successExample]);

  const [activeTab, setActiveTab] = useState<ApiCodeTab>(() => tabs[0]?.id ?? "success");
  const activeCode = tabs.find((tab) => tab.id === activeTab)?.code ?? tabs[0]?.code ?? "";
  const activeMeta = tabMeta[activeTab];

  if (!tabs.length) {
    return (
      <div className="api-code-panel api-code-panel-empty">
        <p>{t("merchant.apiDocs.codePanel.empty")}</p>
      </div>
    );
  }

  return (
    <div className="api-code-panel">
      <div className="api-code-panel-tabs" role="tablist" aria-label={t("merchant.apiDocs.codePanel.tabsAria")}>
        {tabs.map((tab) => {
          const meta = tabMeta[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`api-code-panel-tab api-code-panel-tab-${meta.tone}${
                activeTab === tab.id ? " is-active" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="api-code-panel-badge">{meta.badge}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="api-code-panel-body" role="tabpanel">
        <div className="api-code-panel-toolbar">
          <span className={`api-code-panel-status api-code-panel-status-${activeMeta.tone}`}>
            {activeMeta.badge}
          </span>
          <button
            className="ghost-button api-code-panel-copy"
            onClick={() => void onCopy(activeCode, `${endpointId} ${activeTab}`)}
            type="button"
          >
            {t("common.copy")}
          </button>
        </div>
        <pre className="json-box api-code-panel-pre">{activeCode}</pre>
      </div>
    </div>
  );
}
