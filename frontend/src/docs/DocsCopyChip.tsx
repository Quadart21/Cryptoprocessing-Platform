import { useState } from "react";

export function DocsCopyChip({ value, label }: { value: string; label?: string }) {
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
        {copied ? "Copied" : label ?? "Copy"}
      </button>
    </div>
  );
}
