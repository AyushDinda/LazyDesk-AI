import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "LazyDesk AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Allowed roots for file operations
    ALLOWED_ROOTS: List[str] = [
        str(Path.cwd().resolve()),
        str((Path.cwd() / "sample_messy_folder").resolve()),
    ]
    
    # Local AI Configuration (Ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3"
    MOCK_AI: bool = False
    
    # Document Limits
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    MAX_EXTRACT_CHARS: int = 4000
    
    # Database
    DATABASE_URL: str = "sqlite:///./lazydesk.db"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
