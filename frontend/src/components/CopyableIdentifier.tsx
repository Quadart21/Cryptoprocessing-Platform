import { useState } from "react";

import { useTranslation } from "../i18n";

type CopyableIdentifierProps = {
  label: string;
  value: string | null | undefined;
  hint?: string;
  className?: string;
  emptyLabel?: string;
  variant?: "block" | "chip" | "inline";
};

export function CopyableIdentifier({
  label,
  value,
  hint,
  className = "",
  emptyLabel,
  variant = "block",
}: CopyableIdentifierProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const display = value?.trim() ? value.trim() : null;
  const resolvedEmptyLabel = emptyLabel ?? t("common.dash");

  async function handleCopy() {
    if (!display) {
      return;
    }
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const rootClass = [
    variant === "chip"
      ? "detail-chip copyable-id copyable-id--chip"
      : variant === "inline"
        ? "copyable-id copyable-id--inline"
        : "copyable-id copyable-id--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <span className="copyable-id-label">{label}</span>
      {hint && variant === "block" ? <p className="copyable-id-hint muted-text">{hint}</p> : null}
      <div className="copyable-id-row">
        <code className="copyable-id-value">{display ?? resolvedEmptyLabel}</code>
        {display ? (
          <button type="button" className="ghost-button copyable-id-btn" onClick={() => void handleCopy()}>
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        ) : null}
      </div>
      {hint && variant === "chip" ? <p className="copyable-id-hint muted-text">{hint}</p> : null}
    </div>
  );
}
