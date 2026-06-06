import { useRef, useState, type ChangeEvent } from "react";

const UPLOADED_LOGO_PREFIX = "/uploads/brand/";

function resolveLogoPreviewUrl(url: string | null | undefined): string | null {
  const normalized = url?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  if (normalized.startsWith("/")) {
    return `${window.location.origin}${normalized}`;
  }
  return normalized;
}

type BrandLogoUploaderProps = {
  logoUrl: string | null | undefined;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemoveUploaded: () => Promise<void>;
};

export function BrandLogoUploader({
  logoUrl,
  disabled = false,
  onUpload,
  onRemoveUploaded,
}: BrandLogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewUrl = resolveLogoPreviewUrl(logoUrl);
  const isUploadedAsset = (logoUrl ?? "").startsWith(UPLOADED_LOGO_PREFIX);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setLocalError(null);
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Не удалось загрузить логотип.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setLocalError(null);
    setBusy(true);
    try {
      await onRemoveUploaded();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Не удалось удалить логотип.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aps-brand-logo-uploader">
      <div className="aps-brand-logo-preview">
        {previewUrl ? (
          <img alt="Текущий логотип" className="aps-brand-logo-preview-img" src={previewUrl} />
        ) : (
          <span className="muted-text">Логотип не задан</span>
        )}
      </div>

      <div className="aps-brand-logo-actions">
        <input
          ref={inputRef}
          accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
          className="aps-brand-logo-input"
          disabled={disabled || busy}
          onChange={(event) => void handleFileChange(event)}
          type="file"
        />
        <button
          className="ghost-button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {busy ? "Загрузка…" : "Загрузить SVG/PNG"}
        </button>
        {isUploadedAsset ? (
          <button
            className="ghost-button"
            disabled={disabled || busy}
            onClick={() => void handleRemove()}
            type="button"
          >
            Удалить файл
          </button>
        ) : null}
      </div>

      {localError ? <p className="form-error">{localError}</p> : null}
    </div>
  );
}

export function isUploadedBrandLogo(url: string | null | undefined): boolean {
  return (url ?? "").startsWith(UPLOADED_LOGO_PREFIX);
}
