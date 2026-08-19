"""Spend analytics. Every aggregate honours the same filters as the table."""

from __future__ import annotations

import time
from dataclasses import replace
from typing import Any

from sqlalchemy.orm import Session

from app.api.filters import TransactionFilters
from app.repositories import analytics as repo


def overview(
    session: Session, *, user_id: int, filters: TransactionFilters
) -> dict[str, Any]:
    started = time.perf_counter()
    # Charts never include the quarantined row; one corrupt ₹99,99,99,999
    # payment would otherwise swamp every scale on the page.
    clean = replace(filters, include_quarantined=False)

    # The calendar is a brush control, not a readout: it must always show the
    # whole date domain so that clicking a day narrows the rest of the page
    # without collapsing the control you just clicked in. It still honours
    # every non-date filter, so picking a category reshapes it.
    undated = replace(clean, date_from=None, date_to=None, months=[])

    return {
        "kpis": repo.kpis(session, user_id=user_id, filters=clean),
        "by_category": repo.by_category(session, user_id=user_id, filters=clean),
        "by_month": repo.by_month(session, user_id=user_id, filters=clean),
        "by_day": repo.by_day(session, user_id=user_id, filters=undated),
        "by_method": repo.by_method(session, user_id=user_id, filters=clean),
        "top_merchants": repo.top_merchants(session, user_id=user_id, filters=clean),
        "query_ms": int((time.perf_counter() - started) * 1000),
    }
