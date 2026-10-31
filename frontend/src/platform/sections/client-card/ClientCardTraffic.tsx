import { useCallback, useState } from "react";

import type { ProjectItem } from "../../../api";
import { fetchProjectApiUsage, fetchTenantApiUsage } from "../../../api/admin";
import { ApiUsagePanel } from "../../components/ApiUsagePanel";

type ClientCardTrafficProps = {
  projects: ProjectItem[];
  tenantId: string;
  token: string;
};

export function ClientCardTraffic({ projects, tenantId, token }: ClientCardTrafficProps) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const activeId = projects.some((item) => item.id === projectId) ? projectId : null;
  const project = projects.find((item) => item.id === activeId) ?? null;

  const loadUsage = useCallback(
    (period: number) => {
      if (activeId) return fetchProjectApiUsage(token, activeId, period);
      return fetchTenantApiUsage(token, tenantId, period);
    },
    [activeId, tenantId, token],
  );

  return (
    <div className="cc-stack">
      {projects.length > 1 ? (
        <div className="cc-segments" role="tablist" aria-label="Проект для статистики">
          <button
            aria-selected={activeId === null}
            className={`segment-button ${activeId === null ? "segment-button-active" : ""}`}
            onClick={() => setProjectId(null)}
            type="button"
          >
            Весь клиент
          </button>
          {projects.map((item) => (
            <button
              aria-selected={activeId === item.id}
              className={`segment-button ${activeId === item.id ? "segment-button-active" : ""}`}
              key={item.id}
              onClick={() => setProjectId(item.id)}
              type="button"
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <ApiUsagePanel
        days={days}
        loadUsage={loadUsage}
        onDaysChange={setDays}
        subtitle="Хранится 45 дней"
        title={project ? project.name : "Весь клиент"}
      />
    </div>
  );
}
