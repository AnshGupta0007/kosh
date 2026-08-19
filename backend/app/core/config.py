"""Application settings, read once from the environment."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = "postgresql+psycopg://kosh:kosh@localhost:5433/kosh"
    cors_origins: str = "http://localhost:3000"
    demo_user_email: str = "demo@kosh.app"
    demo_user_name: str = "Ansh Gupta"

    # Product rules that the brief left to us, kept in one place so the API,
    # the seed loader and the docs can never drift apart.
    coins_per_rupee_divisor: int = 100  # 1 coin per ₹100
    coin_cap_per_transaction: int = 100  # capped at 100 coins (~₹10,000 of spend)
    # Anything at or above this is treated as corrupt rather than as a real
    # payment. The dataset contains exactly one such row (₹999,999,999).
    quarantine_amount_paise: int = 10_000_000_00  # ₹1 crore

    max_page_size: int = 200

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        """Normalise the URL hosted Postgres providers hand out.

        Render, Railway, Heroku and Neon all export `postgres://…` or
        `postgresql://…`. SQLAlchemy reads the scheme as the driver name, so
        without this the app boots fine locally and dies on deploy with
        "Can't load plugin: sqlalchemy.dialects:postgres".
        """
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
