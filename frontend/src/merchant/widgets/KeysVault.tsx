import type { ApiKeyItem } from "../../api";
import { useEffect, useState } from "react";

import { useTranslation } from "../../i18n";

export type KeysVaultProps = {
  apiKeys: ApiKeyItem[];
  activeApiKeyPublic: string | null;
  onRegenerate: (apiKeyId: string) => void;
  onRevoke: (apiKeyId: string) => void;
};

export function KeysVault({
  apiKeys,
  activeApiKeyPublic,
  onRegenerate,
  onRevoke,
}: KeysVaultProps) {
  const { t } = useTranslation();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }
    const timer = window.setTimeout(() => setCopyMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  async function handleCopy(value: string | null) {
    if (!value) {
      setCopyMessage(t("merchant.widgets.keysVault.noPublicKeyCopy"));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(t("merchant.widgets.keysVault.publicKeyCopied"));
    } catch {
      setCopyMessage(t("merchant.widgets.keysVault.copyFailed"));
    }
  }

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">{t("merchant.widgets.keysVault.eyebrow")}</p>
        <h2 className="mc-surface-title">{t("merchant.widgets.keysVault.title")}</h2>
        <p className="mc-surface-desc">{t("merchant.widgets.keysVault.description")}</p>
      </header>

      <div className="mc-key-banner">
        <div>
          <p className="mc-surface-eyebrow" style={{ marginBottom: 8 }}>
            {t("merchant.widgets.keysVault.activePublicKey")}
          </p>
          <code className="mc-key-code">
            {activeApiKeyPublic ?? t("merchant.widgets.keysVault.noActiveKey")}
          </code>
        </div>
        <button className="ghost-button" onClick={() => void handleCopy(activeApiKeyPublic)} type="button">
          {t("common.copy")}
        </button>
      </div>
      {copyMessage ? <p className="mc-inline-toast">{copyMessage}</p> : null}

      <p className="mc-surface-eyebrow" style={{ marginBottom: 12 }}>
        {t("merchant.widgets.keysVault.allKeys")}
      </p>
      <div className="mc-rows">
        {apiKeys.length === 0 ? (
          <div className="mc-empty">{t("merchant.widgets.keysVault.empty")}</div>
        ) : (
          apiKeys.map((apiKey) => (
            <div className="mc-row" key={apiKey.id}>
              <div>
                <p className="mc-row-title mc-row-mono">{apiKey.public_key}</p>
                <div className="mc-row-badges">
                  <span className="mc-badge mc-badge-neutral">{apiKey.status}</span>
                </div>
              </div>
              <div className="mc-row-actions">
                <button className="ghost-button" onClick={() => onRegenerate(apiKey.id)} type="button">
                  {t("merchant.widgets.keysVault.regenerate")}
                </button>
                <button className="ghost-button" onClick={() => onRevoke(apiKey.id)} type="button">
                  {t("merchant.widgets.keysVault.revoke")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
