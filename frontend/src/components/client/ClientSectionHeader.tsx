type ClientSectionHeaderProps = {
  group: string;
  title: string;
  description: string;
};

export function ClientSectionHeader({ group, title, description }: ClientSectionHeaderProps) {
  return (
    <header className="client-section-header">
      <p className="client-section-header-eyebrow">{group}</p>
      <h1 className="client-section-header-title">{title}</h1>
      <p className="client-section-header-desc">{description}</p>
    </header>
  );
}
