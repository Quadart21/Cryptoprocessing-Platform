import type { ProjectItem } from "../../api";
import { useTranslation } from "../../i18n";

export type ProjectDirectoryProps = {
  projects: ProjectItem[];
};

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "published") {
    return "mc-badge-ok";
  }
  if (s === "pending" || s === "draft") {
    return "mc-badge-warn";
  }
  return "mc-badge-neutral";
}

export function ProjectDirectory({ projects }: ProjectDirectoryProps) {
  const { t } = useTranslation();

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">{t("merchant.widgets.projectDirectory.eyebrow")}</p>
        <h2 className="mc-surface-title">{t("merchant.widgets.projectDirectory.title")}</h2>
        <p className="mc-surface-desc">{t("merchant.widgets.projectDirectory.description")}</p>
      </header>

      <div className="mc-rows">
        {projects.length === 0 ? (
          <div className="mc-empty">{t("merchant.widgets.projectDirectory.empty")}</div>
        ) : (
          projects.map((project) => (
            <div className="mc-row" key={project.id}>
              <div>
                <p className="mc-row-title">{project.name}</p>
                <p className="mc-row-sub">{project.domain}</p>
                <p className="mc-row-sub" style={{ color: "var(--text-2)", fontSize: 12 }}>
                  {project.description ?? t("common.noDescription")}
                </p>
              </div>
              <div className="mc-row-badges">
                <span className={`mc-badge ${statusClass(project.status)}`}>{project.status}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
