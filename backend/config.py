from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://spechouse:spechouse@localhost:5432/spechouse"
    RENTCAST_API_KEY: str = ""
    HOWLOUD_API_KEY: str = ""
    SPOTCRIME_API_KEY: str = ""
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"

    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")


settings = Settings()
