/** Минимальный UI на время загрузки ленивого чанка (React.lazy + Suspense). */
export function AppRouteFallback() {
  return (
    <div className="app-route-fallback" role="status" aria-live="polite" aria-busy="true">
      <div className="app-route-fallback-inner">
        <span aria-hidden className="app-route-spinner" />
        <p>Загрузка интерфейса…</p>
      </div>
    </div>
  );
}
