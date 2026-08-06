from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "HRIS System"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Comma-separated list of allowed frontend origins. No wildcard in production.
    CORS_ORIGINS: str = "http://localhost:4002,http://localhost:5173,http://127.0.0.1:4002,http://127.0.0.1:5173"

    # Email (Resend) - used for password reset links
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "onboarding@resend.dev"
    FRONTEND_URL: str = "http://localhost:4002"

    # SeaweedFS S3-gateway object storage for employee documents (same
    # pattern/env-var names as the dossier project's storage.py, so ops only
    # has to remember one convention). Any S3-compatible backend works since
    # access is via boto3. When unset, the app falls back to local disk.
    SEAWEED_S3_ENDPOINT: str = ""
    SEAWEED_REGION: str = "us-east-1"
    SEAWEED_ACCESS_KEY: str = ""
    SEAWEED_SECRET_KEY: str = ""
    SEAWEED_BUCKET_NAME: str = "hris"
    PRESIGNED_URL_TTL_SECONDS: int = 300

    # Firebase Admin SDK - used server-side only to verify the ID token the
    # frontend gets back after a user completes phone OTP verification via
    # the Firebase JS SDK (client-side). This backend never talks to
    # Firebase's SMS API directly - see app/core/firebase.py. Requires a
    # service-account JSON key from the Firebase project's console (Project
    # Settings > Service Accounts > Generate new private key); point this at
    # its path on disk (mounted into the container, not committed to git).
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()