import type { ApiKeyItem } from "../../api";
import { useState } from "react";

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

  async function handleCopy(value: string | null) {
    if (!value) {
      setCopyMessage("Активный public key не найден.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage("Public key скопирован.");
    } catch {
      setCopyMessage("Не удалось скопировать public key.");
    }
  }

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">API-ключи</p>
          <h2>Интеграция</h2>
        </div>
      </div>
      <div className="integration-key-focus">
        <div>
          <p className="eyebrow">Активный public key</p>
          <code className="integration-key-value">
            {activeApiKeyPublic ?? "Активный ключ не найден"}
          </code>
          <p className="muted-text">
            Используйте этот public key вместе с secret key. Сам secret key показывается только
            один раз после создания или перевыпуска ключа, поэтому сохраните его сразу.
          </p>
        </div>
        <button
          className="ghost-button"
          onClick={() => void handleCopy(activeApiKeyPublic)}
          type="button"
        >
          Копировать public key
        </button>
      </div>
      {copyMessage ? <p className="muted-text integration-copy-note">{copyMessage}</p> : null}
      <div className="tenant-list">
        {apiKeys.length === 0 ? (
          <p className="muted-text">Ключи пока не выданы.</p>
        ) : (
          apiKeys.map((apiKey) => (
            <article className="tenant-card" key={apiKey.id}>
              <div>
                <strong>{apiKey.public_key}</strong>
              </div>
              <div className="tenant-meta">
                <span>{apiKey.status}</span>
                <button
                  className="ghost-button"
                  onClick={() => onRegenerate(apiKey.id)}
                  type="button"
                >
                  Перевыпустить
                </button>
                <button className="ghost-button" onClick={() => onRevoke(apiKey.id)} type="button">
                  Отозвать
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </article>
  );
}
