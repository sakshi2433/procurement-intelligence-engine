from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://procurement:procurement@localhost:5432/procurement_db"

    # LLM
    LLM_PROVIDER: Literal["openai", "groq", "anthropic", "ollama"] = "openai"
    LLM_MODEL: str = "gpt-4o-mini"
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Embeddings
    EMBEDDING_PROVIDER: Literal["openai", "sentence-transformers"] = "sentence-transformers"

    # Odoo
    USE_ODOO: bool = False
    ODOO_URL: str = ""
    ODOO_DB: str = ""
    ODOO_USERNAME: str = ""
    ODOO_PASSWORD: str = ""

    # App
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me"
    CORS_ORIGINS: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
