import type { ProjectItem } from "../../api";

type ProjectsPanelProps = {
  projects: ProjectItem[];
};

export function ProjectsPanel({ projects }: ProjectsPanelProps) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Проекты</p>
          <h2>Основные данные</h2>
        </div>
      </div>
      <div className="tenant-list">
        {projects.map((project) => (
          <article className="tenant-card" key={project.id}>
            <div>
              <strong>{project.name}</strong>
              <p>{project.domain}</p>
              <p>{project.description ?? "Без описания"}</p>
            </div>
            <div className="tenant-meta">
              <span>{project.status}</span>
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}
