type HeroInfoCardProps = {
  eyebrow: string;
  title: string;
  rows: Array<{ label: string; value: string }>;
};

export function HeroInfoCard({ eyebrow, title, rows }: HeroInfoCardProps) {
  return (
    <article className="hero-panel hero-panel-side">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <div className="hero-side-list">
        {rows.map((row) => (
          <div className="hero-side-row" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
