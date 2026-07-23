from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import EmailStr

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # SMTP Configuration
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_FROM_EMAIL: EmailStr
    SMTP_FROM_NAME: str = "BLE Sense Ecosystem"

    # Default Admin Config
    DEFAULT_ADMIN_USERNAME: str = "saurabh"
    DEFAULT_ADMIN_EMAIL: EmailStr = "thedev.saurabh@gmail.com"
    DEFAULT_ADMIN_PASSWORD: str = "AdminChangeMe123!"

    # URLs
    FRONTEND_URL: str = "https://blecom.netlify.app/"

    # Pydantic Settings Configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # Ignores extra environment variables like PORT and HOST
    )

settings = Settings()
