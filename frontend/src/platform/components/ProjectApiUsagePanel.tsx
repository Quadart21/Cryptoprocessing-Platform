import { useCallback } from "react";

import { fetchProjectApiUsage } from "../../api/admin";
import { ApiUsagePanel } from "./ApiUsagePanel";

type ProjectApiUsagePanelProps = {
  token: string;
  projectId: string;
  projectName: string;
};

export function ProjectApiUsagePanel({ token, projectId, projectName }: ProjectApiUsagePanelProps) {
  const loadUsage = useCallback(
    (days: number) => fetchProjectApiUsage(token, projectId, days),
    [token, projectId],
  );

  return (
    <ApiUsagePanel
      loadUsage={loadUsage}
      subtitle="API-трафик и rate limit"
      title={projectName}
    />
  );
}
