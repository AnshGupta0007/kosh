"""Engine and session plumbing. Nothing app-specific belongs in here."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # hosted Postgres (Neon/Render) drops idle connections
    pool_size=5,
    max_overflow=5,
    # Fail fast when the database is unreachable. Without a connect timeout,
    # psycopg waits on the OS default (~75s on macOS), so every request hangs
    # until the client gives up and the UI shows a spinner forever instead of
    # its error state. Five seconds is well past a healthy connect and short
    # enough that a dead database surfaces as an error, not as a hang.
    connect_args={"connect_timeout": 5},
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
