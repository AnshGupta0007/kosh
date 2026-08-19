"""Transaction listing logic: timing, page maths, not-found handling."""

from __future__ import annotations

import math
import time
from typing import Any

from sqlalchemy.orm import Session

from app.api.filters import TransactionFilters
from app.core.errors import TransactionNotFound
from app.repositories import transactions as repo


def list_transactions(
    session: Session,
    *,
    user_id: int,
    filters: TransactionFilters,
    sort: str,
    order: str,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    started = time.perf_counter()
    rows, total, spend, refunds = repo.list_page(
        session,
        user_id=user_id,
        filters=filters,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )
    total_pages = max(1, math.ceil(total / page_size))

    return {
        "items": rows,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        },
        "filtered_total_paise": spend,
        "filtered_refund_paise": refunds,
        "query_ms": int((time.perf_counter() - started) * 1000),
    }


def get_transaction(session: Session, *, user_id: int, transaction_id: int) -> dict[str, Any]:
    row = repo.get_by_id(session, user_id=user_id, transaction_id=transaction_id)
    if row is None:
        raise TransactionNotFound(f"No transaction with id {transaction_id}.")
    return row


def filter_options(session: Session, *, user_id: int) -> dict[str, Any]:
    return repo.filter_options(session, user_id=user_id)
