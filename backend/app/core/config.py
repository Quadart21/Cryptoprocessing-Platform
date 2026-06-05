from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"

DEFAULT_SECRET_KEY_VALUES = {"", "change-me", "changeme", "secret", "dev-secret"}
DEFAULT_SUPERADMIN_EMAILS = {"admin@example.com"}
DEFAULT_SUPERADMIN_PASSWORDS = {
    "changeme123!",
    "change-me",
    "password",
    "admin",
    "12345678",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = Field(default="NorenDigital", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_debug: bool = Field(default=False, alias="APP_DEBUG")
    public_api_base_url: str = Field(default="", alias="PUBLIC_API_BASE_URL")
    public_pay_base_url: str = Field(default="", alias="PUBLIC_PAY_BASE_URL")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")

    security_fail_fast: bool = Field(default=True, alias="SECURITY_FAIL_FAST")
    allow_insecure_defaults_in_local: bool = Field(
        default=False,
        alias="ALLOW_INSECURE_DEFAULTS_IN_LOCAL",
    )
    secret_key: str = Field(default="change-me", alias="SECRET_KEY")
    jwt_secret_key: str = Field(default="", alias="JWT_SECRET_KEY")
    fernet_secret_key: str = Field(default="", alias="FERNET_SECRET_KEY")
    webhook_secret_key: str = Field(default="", alias="WEBHOOK_SECRET_KEY")

    access_token_expire_minutes: int = Field(
        default=30,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_minutes: int = Field(
        default=10080,
        alias="REFRESH_TOKEN_EXPIRE_MINUTES",
    )

    backend_cors_origins_raw: str = Field(
        default="http://localhost:5173",
        alias="BACKEND_CORS_ORIGINS",
    )
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="cryptoprocessing", alias="POSTGRES_DB")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="postgres", alias="POSTGRES_PASSWORD")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    db_pool_size: int = Field(default=20, alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=30, alias="DB_MAX_OVERFLOW")
    db_pool_timeout_seconds: int = Field(default=10, alias="DB_POOL_TIMEOUT_SECONDS")
    db_pool_recycle_seconds: int = Field(default=1800, alias="DB_POOL_RECYCLE_SECONDS")
    db_connect_timeout_seconds: int = Field(default=5, alias="DB_CONNECT_TIMEOUT_SECONDS")
    db_statement_timeout_ms: int = Field(default=15000, alias="DB_STATEMENT_TIMEOUT_MS")

    cache_default_ttl_seconds: int = Field(default=30, alias="CACHE_DEFAULT_TTL_SECONDS")
    cache_rates_ttl_seconds: int = Field(default=2, alias="CACHE_RATES_TTL_SECONDS")
    cache_provider_currencies_ttl_seconds: int = Field(
        default=60,
        alias="CACHE_PROVIDER_CURRENCIES_TTL_SECONDS",
    )
    cache_accounting_summary_ttl_seconds: int = Field(
        default=20,
        alias="CACHE_ACCOUNTING_SUMMARY_TTL_SECONDS",
    )

    provider_http_connect_timeout_seconds: int = Field(
        default=5,
        alias="PROVIDER_HTTP_CONNECT_TIMEOUT_SECONDS",
    )
    provider_http_read_timeout_seconds: int = Field(
        default=20,
        alias="PROVIDER_HTTP_READ_TIMEOUT_SECONDS",
    )
    provider_http_pool_connections: int = Field(
        default=20,
        alias="PROVIDER_HTTP_POOL_CONNECTIONS",
    )
    provider_http_pool_maxsize: int = Field(
        default=50,
        alias="PROVIDER_HTTP_POOL_MAXSIZE",
    )
    client_webhook_connect_timeout_seconds: int = Field(
        default=3,
        alias="CLIENT_WEBHOOK_CONNECT_TIMEOUT_SECONDS",
    )
    client_webhook_read_timeout_seconds: int = Field(
        default=10,
        alias="CLIENT_WEBHOOK_READ_TIMEOUT_SECONDS",
    )
    client_webhook_pool_connections: int = Field(
        default=10,
        alias="CLIENT_WEBHOOK_POOL_CONNECTIONS",
    )
    client_webhook_pool_maxsize: int = Field(
        default=20,
        alias="CLIENT_WEBHOOK_POOL_MAXSIZE",
    )

    superadmin_email: str = Field(default="admin@example.com", alias="SUPERADMIN_EMAIL")
    superadmin_password: str = Field(
        default="ChangeMe123!",
        alias="SUPERADMIN_PASSWORD",
    )
    superadmin_full_name: str = Field(default="Super Admin", alias="SUPERADMIN_FULL_NAME")

    payment_provider: str = Field(default="mock", alias="PAYMENT_PROVIDER")
    crypto_cash_api_base_url: str = Field(
        default="https://api.crypto-cash.world",
        alias="CRYPTO_CASH_API_BASE_URL",
    )
    crypto_cash_public_key: str = Field(default="", alias="CRYPTO_CASH_PUBLIC_KEY")
    crypto_cash_secret_key: str = Field(default="", alias="CRYPTO_CASH_SECRET_KEY")
    crypto_cash_rates_export_url: str = Field(
        default="https://rates.crypto-cash.world/api/v1/market/rates/export/json",
        alias="CRYPTO_CASH_RATES_EXPORT_URL",
    )
    exchange_rate_poll_interval_seconds: int = Field(
        default=2,
        alias="EXCHANGE_RATE_POLL_INTERVAL_SECONDS",
    )

    webhook_require_signature: bool = Field(default=True, alias="WEBHOOK_REQUIRE_SIGNATURE")
    webhook_allow_legacy_payload: bool = Field(
        default=False,
        alias="WEBHOOK_ALLOW_LEGACY_PAYLOAD",
    )
    webhook_allow_legacy_signature: bool = Field(
        default=False,
        alias="WEBHOOK_ALLOW_LEGACY_SIGNATURE",
    )
    webhook_max_skew_seconds: int = Field(default=300, alias="WEBHOOK_MAX_SKEW_SECONDS")
    webhook_allow_http_in_local: bool = Field(
        default=True,
        alias="WEBHOOK_ALLOW_HTTP_IN_LOCAL",
    )

    auth_lockout_threshold: int = Field(default=5, alias="AUTH_LOCKOUT_THRESHOLD")
    auth_lockout_minutes: int = Field(default=15, alias="AUTH_LOCKOUT_MINUTES")
    balance_hold_hours: int = Field(default=24, alias="BALANCE_HOLD_HOURS")
    max_concurrent_sessions_per_user: int = Field(default=3, alias="MAX_CONCURRENT_SESSIONS_PER_USER")

    rate_limit_login_ip_per_minute: int = Field(
        default=20,
        alias="RATE_LIMIT_LOGIN_IP_PER_MINUTE",
    )
    rate_limit_register_ip_per_10m: int = Field(
        default=8,
        alias="RATE_LIMIT_REGISTER_IP_PER_10M",
    )
    rate_limit_invoice_ip_per_minute: int = Field(
        default=120,
        alias="RATE_LIMIT_INVOICE_IP_PER_MINUTE",
    )
    rate_limit_invoice_auth_per_minute: int = Field(
        default=90,
        alias="RATE_LIMIT_INVOICE_AUTH_PER_MINUTE",
    )
    invoice_payment_ttl_minutes: int = Field(
        default=60,
        alias="INVOICE_PAYMENT_TTL_MINUTES",
    )
    rate_limit_read_ip_per_minute: int = Field(
        default=300,
        alias="RATE_LIMIT_READ_IP_PER_MINUTE",
    )
    rate_limit_public_pay_refresh_ip_per_minute: int = Field(
        default=40,
        alias="RATE_LIMIT_PUBLIC_PAY_REFRESH_IP_PER_MINUTE",
    )
    rate_limit_burst_enabled: bool = Field(default=True, alias="RATE_LIMIT_BURST_ENABLED")
    rate_limit_burst_window_seconds: int = Field(
        default=10,
        alias="RATE_LIMIT_BURST_WINDOW_SECONDS",
    )
    rate_limit_global_burst_ip_limit: int = Field(
        default=45,
        alias="RATE_LIMIT_GLOBAL_BURST_IP_LIMIT",
    )
    rate_limit_global_burst_ip_window_seconds: int = Field(
        default=10,
        alias="RATE_LIMIT_GLOBAL_BURST_IP_WINDOW_SECONDS",
    )
    rate_limit_api_key_account_per_minute: int = Field(
        default=600,
        alias="RATE_LIMIT_API_KEY_ACCOUNT_PER_MINUTE",
    )
    rate_limit_api_key_account_burst: int = Field(
        default=50,
        alias="RATE_LIMIT_API_KEY_ACCOUNT_BURST",
    )
    max_concurrent_connections_per_ip: int = Field(
        default=30,
        alias="MAX_CONCURRENT_CONNECTIONS_PER_IP",
    )
    max_concurrent_connection_ttl_seconds: int = Field(
        default=120,
        alias="MAX_CONCURRENT_CONNECTION_TTL_SECONDS",
    )
    rate_limit_webhook_test_ip_per_minute: int = Field(
        default=30,
        alias="RATE_LIMIT_WEBHOOK_TEST_IP_PER_MINUTE",
    )
    rate_limit_webhook_test_auth_per_minute: int = Field(
        default=20,
        alias="RATE_LIMIT_WEBHOOK_TEST_AUTH_PER_MINUTE",
    )
    rate_limit_internal_webhook_ip_per_minute: int = Field(
        default=240,
        alias="RATE_LIMIT_INTERNAL_WEBHOOK_IP_PER_MINUTE",
    )
    rate_limit_otp_per_minute: int = Field(
        default=20,
        alias="RATE_LIMIT_OTP_PER_MINUTE",
    )
    rate_limit_set_password_per_minute: int = Field(
        default=10,
        alias="RATE_LIMIT_SET_PASSWORD_PER_MINUTE",
    )
    rate_limit_2fa_enable_per_minute: int = Field(
        default=10,
        alias="RATE_LIMIT_2FA_ENABLE_PER_MINUTE",
    )
    rate_limit_payout_create_per_minute: int = Field(
        default=5,
        alias="RATE_LIMIT_PAYOUT_CREATE_PER_MINUTE",
    )
    rate_limit_sandbox_enroll_ip_per_minute: int = Field(
        default=12,
        alias="RATE_LIMIT_SANDBOX_ENROLL_IP_PER_MINUTE",
    )

    @property
    def backend_cors_origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.backend_cors_origins_raw.split(",")
            if item.strip()
        ]

    @property
    def sqlalchemy_database_uri(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def normalized_app_env(self) -> str:
        return self.app_env.strip().lower()

    @property
    def is_local_env(self) -> bool:
        return self.normalized_app_env in {"local", "dev", "development", "test"}

    @property
    def is_production(self) -> bool:
        return self.normalized_app_env in {"prod", "production"}

    @property
    def effective_jwt_secret(self) -> str:
        return self.jwt_secret_key or self.secret_key

    @property
    def effective_fernet_secret(self) -> str:
        return self.fernet_secret_key or self.secret_key

    @property
    def effective_webhook_secret(self) -> str:
        return self.webhook_secret_key or self.secret_key

    @property
    def legacy_webhook_payload_allowed(self) -> bool:
        if self.is_production:
            return False
        return self.webhook_allow_legacy_payload

    @property
    def legacy_webhook_signature_allowed(self) -> bool:
        if self.is_production:
            return False
        return self.webhook_allow_legacy_signature

    @model_validator(mode="after")
    def validate_security_defaults(self) -> "Settings":
        if not self.security_fail_fast:
            return self

        if self.is_local_env and self.allow_insecure_defaults_in_local:
            return self

        errors: list[str] = []

        if self.secret_key.strip().lower() in DEFAULT_SECRET_KEY_VALUES:
            errors.append("SECRET_KEY is insecure. Set a strong random value.")
        if self.jwt_secret_key.strip() == "":
            errors.append("JWT_SECRET_KEY must be set in production.")
        if self.fernet_secret_key.strip() == "":
            errors.append("FERNET_SECRET_KEY must be set in production.")
        if self.webhook_secret_key.strip() == "":
            errors.append("WEBHOOK_SECRET_KEY must be set in production.")
        if self.app_debug:
            errors.append("APP_DEBUG=true is forbidden for secured environments.")
        if self.superadmin_email.strip().lower() in DEFAULT_SUPERADMIN_EMAILS:
            errors.append("SUPERADMIN_EMAIL uses a default value.")
        if self.superadmin_password.strip().lower() in DEFAULT_SUPERADMIN_PASSWORDS:
            errors.append("SUPERADMIN_PASSWORD uses a default value.")
        if self.auth_lockout_threshold < 3:
            errors.append("AUTH_LOCKOUT_THRESHOLD must be >= 3.")
        if self.webhook_max_skew_seconds < 30:
            errors.append("WEBHOOK_MAX_SKEW_SECONDS must be >= 30.")
        if self.refresh_token_expire_minutes <= self.access_token_expire_minutes:
            errors.append(
                "REFRESH_TOKEN_EXPIRE_MINUTES must be greater than ACCESS_TOKEN_EXPIRE_MINUTES."
            )
        if self.db_pool_size <= 0:
            errors.append("DB_POOL_SIZE must be > 0.")
        if self.db_max_overflow < 0:
            errors.append("DB_MAX_OVERFLOW must be >= 0.")
        if self.db_pool_timeout_seconds <= 0:
            errors.append("DB_POOL_TIMEOUT_SECONDS must be > 0.")
        if self.db_connect_timeout_seconds <= 0:
            errors.append("DB_CONNECT_TIMEOUT_SECONDS must be > 0.")
        if self.db_statement_timeout_ms < 1000:
            errors.append("DB_STATEMENT_TIMEOUT_MS must be >= 1000.")
        if self.cache_default_ttl_seconds <= 0:
            errors.append("CACHE_DEFAULT_TTL_SECONDS must be > 0.")
        if self.cache_rates_ttl_seconds <= 0:
            errors.append("CACHE_RATES_TTL_SECONDS must be > 0.")
        if self.cache_provider_currencies_ttl_seconds <= 0:
            errors.append("CACHE_PROVIDER_CURRENCIES_TTL_SECONDS must be > 0.")
        if self.cache_accounting_summary_ttl_seconds <= 0:
            errors.append("CACHE_ACCOUNTING_SUMMARY_TTL_SECONDS must be > 0.")
        if self.provider_http_connect_timeout_seconds <= 0:
            errors.append("PROVIDER_HTTP_CONNECT_TIMEOUT_SECONDS must be > 0.")
        if self.provider_http_read_timeout_seconds <= 0:
            errors.append("PROVIDER_HTTP_READ_TIMEOUT_SECONDS must be > 0.")
        if self.provider_http_pool_connections <= 0:
            errors.append("PROVIDER_HTTP_POOL_CONNECTIONS must be > 0.")
        if self.provider_http_pool_maxsize <= 0:
            errors.append("PROVIDER_HTTP_POOL_MAXSIZE must be > 0.")
        if self.client_webhook_connect_timeout_seconds <= 0:
            errors.append("CLIENT_WEBHOOK_CONNECT_TIMEOUT_SECONDS must be > 0.")
        if self.client_webhook_read_timeout_seconds <= 0:
            errors.append("CLIENT_WEBHOOK_READ_TIMEOUT_SECONDS must be > 0.")
        if self.client_webhook_pool_connections <= 0:
            errors.append("CLIENT_WEBHOOK_POOL_CONNECTIONS must be > 0.")
        if self.client_webhook_pool_maxsize <= 0:
            errors.append("CLIENT_WEBHOOK_POOL_MAXSIZE must be > 0.")
        if self.rate_limit_login_ip_per_minute <= 0:
            errors.append("RATE_LIMIT_LOGIN_IP_PER_MINUTE must be > 0.")
        if self.rate_limit_register_ip_per_10m <= 0:
            errors.append("RATE_LIMIT_REGISTER_IP_PER_10M must be > 0.")
        if self.rate_limit_invoice_ip_per_minute <= 0:
            errors.append("RATE_LIMIT_INVOICE_IP_PER_MINUTE must be > 0.")
        if self.rate_limit_invoice_auth_per_minute <= 0:
            errors.append("RATE_LIMIT_INVOICE_AUTH_PER_MINUTE must be > 0.")
        if self.invoice_payment_ttl_minutes <= 0:
            errors.append("INVOICE_PAYMENT_TTL_MINUTES must be > 0.")
        if self.rate_limit_read_ip_per_minute <= 0:
            errors.append("RATE_LIMIT_READ_IP_PER_MINUTE must be > 0.")
        if self.rate_limit_public_pay_refresh_ip_per_minute <= 0:
            errors.append("RATE_LIMIT_PUBLIC_PAY_REFRESH_IP_PER_MINUTE must be > 0.")
        if self.rate_limit_burst_window_seconds <= 0:
            errors.append("RATE_LIMIT_BURST_WINDOW_SECONDS must be > 0.")
        if self.rate_limit_global_burst_ip_limit < 0:
            errors.append("RATE_LIMIT_GLOBAL_BURST_IP_LIMIT must be >= 0.")
        if self.rate_limit_global_burst_ip_window_seconds <= 0:
            errors.append("RATE_LIMIT_GLOBAL_BURST_IP_WINDOW_SECONDS must be > 0.")
        if self.rate_limit_api_key_account_per_minute < 0:
            errors.append("RATE_LIMIT_API_KEY_ACCOUNT_PER_MINUTE must be >= 0.")
        if self.rate_limit_api_key_account_burst < 0:
            errors.append("RATE_LIMIT_API_KEY_ACCOUNT_BURST must be >= 0.")
        if self.max_concurrent_connections_per_ip < 0:
            errors.append("MAX_CONCURRENT_CONNECTIONS_PER_IP must be >= 0.")
        if self.max_concurrent_connection_ttl_seconds <= 0:
            errors.append("MAX_CONCURRENT_CONNECTION_TTL_SECONDS must be > 0.")
        if self.rate_limit_webhook_test_ip_per_minute <= 0:
            errors.append("RATE_LIMIT_WEBHOOK_TEST_IP_PER_MINUTE must be > 0.")
        if self.rate_limit_webhook_test_auth_per_minute <= 0:
            errors.append("RATE_LIMIT_WEBHOOK_TEST_AUTH_PER_MINUTE must be > 0.")
        if self.rate_limit_internal_webhook_ip_per_minute <= 0:
            errors.append("RATE_LIMIT_INTERNAL_WEBHOOK_IP_PER_MINUTE must be > 0.")
        if self.rate_limit_otp_per_minute <= 0:
            errors.append("RATE_LIMIT_OTP_PER_MINUTE must be > 0.")
        if self.rate_limit_set_password_per_minute <= 0:
            errors.append("RATE_LIMIT_SET_PASSWORD_PER_MINUTE must be > 0.")
        if self.rate_limit_2fa_enable_per_minute <= 0:
            errors.append("RATE_LIMIT_2FA_ENABLE_PER_MINUTE must be > 0.")
        if self.rate_limit_payout_create_per_minute <= 0:
            errors.append("RATE_LIMIT_PAYOUT_CREATE_PER_MINUTE must be > 0.")
        if self.rate_limit_sandbox_enroll_ip_per_minute <= 0:
            errors.append("RATE_LIMIT_SANDBOX_ENROLL_IP_PER_MINUTE must be > 0.")
        if self.max_concurrent_sessions_per_user < 1:
            errors.append("MAX_CONCURRENT_SESSIONS_PER_USER must be >= 1.")

        if errors:
            raise ValueError(" ".join(errors))

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
