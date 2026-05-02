"""Application configuration — single source of truth for env-driven values."""
from __future__ import annotations
import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "foundation_db"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGO: str = "HS256"
    JWT_TTL_DAYS: int = 7

    # Server
    CORS_ORIGINS: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
