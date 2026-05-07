import type { ProjectItem } from "../../api";

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
  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">Структура</p>
        <h2 className="mc-surface-title">Проекты</h2>
        <p className="mc-surface-desc">
          Каждый проект — отдельный контур для инвойсов и webhook. Домен и статус помогают быстро ориентироваться.
        </p>
      </header>

      <div className="mc-rows">
        {projects.length === 0 ? (
          <div className="mc-empty">Проекты не заведены.</div>
        ) : (
          projects.map((project) => (
            <div className="mc-row" key={project.id}>
              <div>
                <p className="mc-row-title">{project.name}</p>
                <p className="mc-row-sub">{project.domain}</p>
                <p className="mc-row-sub" style={{ color: "var(--text-2)", fontSize: 12 }}>
                  {project.description ?? "Без описания"}
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
