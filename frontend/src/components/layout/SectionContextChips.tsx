type SectionContextChip = {
  label: string;
  value: string;
};

type SectionContextChipsProps = {
  items: SectionContextChip[];
};

export function SectionContextChips({ items }: SectionContextChipsProps) {
  return (
    <section className="section-context">
      {items.map((item) => (
        <article className="section-context-chip" key={`${item.label}-${item.value}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}
