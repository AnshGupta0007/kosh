from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import SessionDep, UserDep
from app.api.filters import TransactionFilters, transaction_filters
from app.schemas.analytics import AnalyticsOut
from app.services import analytics as service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsOut, summary="Spend analytics")
def overview(
    session: SessionDep,
    user_id: UserDep,
    filters: Annotated[TransactionFilters, Depends(transaction_filters)],
) -> AnalyticsOut:
    """KPIs plus category, monthly, method and merchant breakdowns.

    Takes the identical filter set as /api/transactions, which is what lets
    the charts and the table cross-filter each other and still agree.
    """
    return AnalyticsOut(**service.overview(session, user_id=user_id, filters=filters))
