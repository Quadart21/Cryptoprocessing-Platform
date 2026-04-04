import type { ApiKeyItem } from "../../api";

type ApiKeysPanelProps = {
  apiKeys: ApiKeyItem[];
  onRegenerate: (apiKeyId: string) => void;
  onRevoke: (apiKeyId: string) => void;
};

export function ApiKeysPanel({ apiKeys, onRegenerate, onRevoke }: ApiKeysPanelProps) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">API-ключи</p>
          <h2>Интеграция</h2>
        </div>
      </div>
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
