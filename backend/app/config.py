import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "RepoPilot"
    debug: bool = False

    project_root: Path = Path(__file__).resolve().parents[2]
    workspace_dir: Path = Path(__file__).resolve().parents[2] / "workspace"
    sandbox_dir: Path = Path(__file__).resolve().parents[2] / "sandbox"

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

_workspace_override = os.getenv("WORKSPACE_DIR", "").strip()
if _workspace_override:
    settings.workspace_dir = Path(_workspace_override)

settings.workspace_dir.mkdir(parents=True, exist_ok=True)
settings.sandbox_dir.mkdir(parents=True, exist_ok=True)

_db_url = settings.database_url
if _db_url.startswith("sqlite:///"):
    db_path = _db_url.removeprefix("sqlite:///")
    if db_path and db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
