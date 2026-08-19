from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.api.deps import SessionDep, UserDep
from app.core.config import settings
from app.schemas.quality import IngestionReport
from app.services import quality as service
from app.services import rewards as rewards_service

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health", summary="Liveness and database check")
def health(session: SessionDep) -> dict:
    """Liveness for the deploy platform, and a real diagnostic for a human.

    The two failure modes look identical from the outside and have completely
    different fixes, so they are reported separately: a database we cannot
    open a connection to, versus one we can reach that has never been seeded.
    Collapsing both into "unreachable" sends you hunting for a network
    problem when the answer is that you have not run the seed yet.
    """
    try:
        session.execute(text("SELECT 1"))
    except Exception as exc:
        return {
            "status": "degraded",
            "database": "unreachable",
            "detail": "Could not open a connection. Check DATABASE_URL.",
            "error": type(exc).__name__,
            "transactions": 0,
        }

    try:
        seeded = session.execute(text("SELECT count(*) FROM transactions")).scalar_one()
    except Exception:
        return {
            "status": "degraded",
            "database": "connected",
            "detail": "Connected, but the schema is missing. Run: python -m app.seed.run",
            "transactions": 0,
        }

    if seeded == 0:
        return {
            "status": "degraded",
            "database": "connected",
            "detail": "Schema exists but holds no rows. Run the seed.",
            "transactions": 0,
        }

    return {"status": "ok", "database": "ok", "transactions": int(seeded)}


@router.get("/me", summary="Current user")
def me(session: SessionDep, user_id: UserDep) -> dict:
    row = session.execute(
        text("SELECT display_name, email, card_last4 FROM users WHERE id = :id"),
        {"id": user_id},
    ).mappings().one()
    return {**dict(row), "coin_rule": rewards_service.coin_rule()}


@router.get("/data-quality", response_model=IngestionReport, summary="Ingestion report")
def data_quality(session: SessionDep) -> IngestionReport:
    """What the loader found in transactions.json and what it did about it.

    Read straight from the tables the seed script wrote — the app never
    recomputes these numbers client-side.
    """
    report = service.latest_report(session)
    if report is None:
        raise HTTPException(status_code=404, detail="No ingestion run recorded yet.")
    return IngestionReport(**report)


@router.get("/config", summary="Product rules the client mirrors")
def config() -> dict:
    return {
        "coins_per_rupee_divisor": settings.coins_per_rupee_divisor,
        "coin_cap_per_transaction": settings.coin_cap_per_transaction,
        "max_page_size": settings.max_page_size,
    }
