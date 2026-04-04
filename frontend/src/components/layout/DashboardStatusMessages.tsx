type DashboardStatusMessagesProps = {
  success: string | null;
  error: string | null;
  newApiSecret?: string | null;
};

export function DashboardStatusMessages({
  success,
  error,
  newApiSecret,
}: DashboardStatusMessagesProps) {
  return (
    <>
      {success ? <p className="result-box page-message">{success}</p> : null}
      {error ? <p className="error-box page-message">{error}</p> : null}
      {newApiSecret ? (
        <p className="result-box page-message">
          <strong>Новый Secret Key:</strong> {newApiSecret}
        </p>
      ) : null}
    </>
  );
}
