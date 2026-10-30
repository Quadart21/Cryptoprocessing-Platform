type SectionContextChip = {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

type SectionContextChipsProps = {
  items: SectionContextChip[];
  className?: string;
};

export function SectionContextChips({ items, className = "" }: SectionContextChipsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Контекст"
      className={["section-context", className].filter(Boolean).join(" ")}
    >
      {items.map((item) => (
        <article
          className={[
            "section-context-chip",
            item.tone ? `section-context-chip--${item.tone}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={`${item.label}-${item.value}`}
        >
          <span className="section-context-chip__label">{item.label}</span>
          <strong className="section-context-chip__value" title={item.value}>
            {item.value}
          </strong>
        </article>
      ))}
    </section>
  );
}
