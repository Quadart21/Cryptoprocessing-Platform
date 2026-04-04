type DashboardPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  user: {
    full_name: string;
    email: string;
  };
  onLogout: () => void;
};

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  user,
  onLogout,
}: DashboardPageHeaderProps) {
  return (
    <section className="topbar topbar-compact">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="topbar-subtitle">{description}</p>
      </div>
      <div className="topbar-actions">
        <div className="identity-chip">
          <strong>{user.full_name}</strong>
          <span>{user.email}</span>
        </div>
        <button className="ghost-button" onClick={onLogout} type="button">
          Выйти из системы
        </button>
      </div>
    </section>
  );
}
