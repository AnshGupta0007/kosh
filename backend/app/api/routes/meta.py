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
    """Used by the deploy platform and by the frontend's connection banner."""
    try:
        seeded = session.execute(text("SELECT count(*) FROM transactions")).scalar_one()
    except Exception:
        return {"status": "degraded", "database": "unreachable", "transactions": 0}
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
