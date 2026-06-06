export function LandingAuthTrustStrip() {
  return (
    <div className="lp-auth-trust-strip" role="note">
      <span className="lp-auth-trust-icon" aria-hidden>
        <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
          <path
            d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
        </svg>
      </span>
      <span>TLS · JWT-сессии · 2FA · изоляция tenant-данных</span>
    </div>
  );
}
