from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "RepoPilot"
    debug: bool = False

    project_root: Path = Path(__file__).resolve().parents[2]
    workspace_dir: Path = project_root / "workspace"
    sandbox_dir: Path = project_root / "sandbox"

    database_url: str = "sqlite:///./repopilot.db"

    # Auth
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    frontend_url: str = "http://localhost:5173"

    # LLM (BYOK)
    default_llm_provider: str = "ollama"
    ollama_base_url: str = "http://localhost:11434"


settings = Settings()

settings.workspace_dir.mkdir(parents=True, exist_ok=True)
settings.sandbox_dir.mkdir(parents=True, exist_ok=True)
