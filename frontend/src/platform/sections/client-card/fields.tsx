type EnumSelectProps = {
  value: string;
  options: readonly string[];
  labelOf: (value: string) => string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function EnumSelect({ value, options, labelOf, onChange, disabled }: EnumSelectProps) {
  const items = !value || options.includes(value) ? options : [value, ...options];
  return (
    <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
      {items.map((item) => (
        <option key={item} title={item} value={item}>
          {labelOf(item)}
        </option>
      ))}
    </select>
  );
}

type StatusPillProps = {
  tone: "ok" | "wait" | "bad" | "muted";
  children: string;
};

export function StatusPill({ tone, children }: StatusPillProps) {
  return <span className={`cc-pill cc-pill-${tone}`}>{children}</span>;
}
