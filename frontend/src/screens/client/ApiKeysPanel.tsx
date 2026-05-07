import type { ApiKeyItem } from "../../api";
import { useEffect, useState } from "react";

type ApiKeysPanelProps = {
  apiKeys: ApiKeyItem[];
  activeApiKeyPublic: string | null;
  onRegenerate: (apiKeyId: string) => void;
  onRevoke: (apiKeyId: string) => void;
};

export function ApiKeysPanel({
  apiKeys,
  activeApiKeyPublic,
  onRegenerate,
  onRevoke,
}: ApiKeysPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }
    const t = window.setTimeout(() => setCopyMessage(null), 2800);
    return () => window.clearTimeout(t);
  }, [copyMessage]);

  async function handleCopy(value: string | null) {
    if (!value) {
      setCopyMessage("Активный public key не найден.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage("Public key скопирован.");
    } catch {
      setCopyMessage("Не удалось скопировать.");
    }
  }

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">Доступ</p>
        <h2 className="mc-surface-title">API-ключи</h2>
        <p className="mc-surface-desc">
          Public и secret используются в заголовках X-API-Key и X-API-Secret. Secret показывается один раз при выпуске —
          сразу сохраните его на сервере.
        </p>
      </header>

      <div className="mc-key-banner">
        <div>
          <p className="mc-surface-eyebrow" style={{ marginBottom: 8 }}>
            Активный public key
          </p>
          <code className="mc-key-code">{activeApiKeyPublic ?? "Ключ не найден — выпустите в кабинете"}</code>
        </div>
        <button className="ghost-button" onClick={() => void handleCopy(activeApiKeyPublic)} type="button">
          Копировать
        </button>
      </div>
      {copyMessage ? <p className="mc-inline-toast">{copyMessage}</p> : null}

      <p className="mc-surface-eyebrow" style={{ marginBottom: 12 }}>
        Все ключи
      </p>
      <div className="mc-rows">
        {apiKeys.length === 0 ? (
          <div className="mc-empty">Ключи ещё не созданы.</div>
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
                  Перевыпустить
                </button>
                <button className="ghost-button" onClick={() => onRevoke(apiKey.id)} type="button">
                  Отозвать
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
