import { useMemo, useState } from "react";

type ApiCodeTab = "request" | "success" | "error";

type ApiCodePanelProps = {
  endpointId: string;
  requestExample?: string;
  successExample: string;
  errorExample: string;
  onCopy: (value: string, label: string) => void | Promise<void>;
};

const TAB_META: Record<ApiCodeTab, { label: string; badge: string; tone: string }> = {
  request: { label: "Запрос", badge: "REQ", tone: "request" },
  success: { label: "Успешный ответ", badge: "2xx", tone: "success" },
  error: { label: "Типовая ошибка", badge: "4xx", tone: "error" },
};

export function ApiCodePanel({
  endpointId,
  requestExample,
  successExample,
  errorExample,
  onCopy,
}: ApiCodePanelProps) {
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
  const activeMeta = TAB_META[activeTab];

  if (!tabs.length) {
    return (
      <div className="api-code-panel api-code-panel-empty">
        <p>Примеры для этого endpoint пока недоступны.</p>
      </div>
    );
  }

  return (
    <div className="api-code-panel">
      <div className="api-code-panel-tabs" role="tablist" aria-label="Примеры API">
        {tabs.map((tab) => {
          const meta = TAB_META[tab.id];
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
            Копировать
          </button>
        </div>
        <pre className="json-box api-code-panel-pre">{activeCode}</pre>
      </div>
    </div>
  );
}
