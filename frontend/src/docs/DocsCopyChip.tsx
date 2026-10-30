import { useState } from "react";

export function DocsCopyChip({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="docs-copy-chip">
      <code>{value}</code>
      <button type="button" onClick={() => void handleCopy()}>
        {copied ? copiedLabel ?? "Copied" : label ?? "Copy"}
      </button>
    </div>
  );
}
