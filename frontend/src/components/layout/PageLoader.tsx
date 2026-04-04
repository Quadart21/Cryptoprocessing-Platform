type PageLoaderProps = {
  label?: string;
};

export function PageLoader({ label = "Загрузка интерфейса..." }: PageLoaderProps) {
  return (
    <div className="page-loader-shell">
      <div className="page-loader-card">
        <span className="page-loader-orb" />
        <strong>{label}</strong>
      </div>
    </div>
  );
}
