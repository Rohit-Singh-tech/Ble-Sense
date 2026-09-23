from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import EmailStr

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./blesense.db"

    # Security
    SECRET_KEY: str = "super_secret_ble_sense_key_change_in_production_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@blesense.com"
    SMTP_FROM_NAME: str = "BLE Sense Ecosystem"

    # Default Admin Config
    DEFAULT_ADMIN_USERNAME: str = "Rohit"
    DEFAULT_ADMIN_EMAIL: EmailStr = "rohitranjan9798490472@gmail.com"
    DEFAULT_ADMIN_PASSWORD: str = "Rohit@123"

    # URLs
    FRONTEND_URL: str = "https://blesense.netlify.app"

    # Pydantic Settings Configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # Ignores extra environment variables like PORT and HOST
    )

settings = Settings()
