from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import SessionDep, UserDep
from app.api.filters import TransactionFilters, transaction_filters
from app.core.config import settings
from app.schemas.transactions import (
    FilterOptions,
    SortField,
    SortOrder,
    TransactionDetailOut,
    TransactionPage,
)
from app.services import transactions as service

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=TransactionPage, summary="List transactions")
def list_transactions(
    session: SessionDep,
    user_id: UserDep,
    filters: Annotated[TransactionFilters, Depends(transaction_filters)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
    sort: SortField = SortField.occurred_at,
    order: SortOrder = SortOrder.desc,
) -> TransactionPage:
    """Filtering, sorting and pagination all happen in Postgres.

    The browser receives one page at a time regardless of how many rows match,
    which is what keeps the table responsive on the full 10,000-row dataset.
    """
    page_size = min(page_size, settings.max_page_size)
    return TransactionPage(
        **service.list_transactions(
            session,
            user_id=user_id,
            filters=filters,
            sort=sort.value,
            order=order.value,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/options", response_model=FilterOptions, summary="Filter option values")
def filter_options(session: SessionDep, user_id: UserDep) -> FilterOptions:
    """Drives the filter UI from the data, so a new category needs no deploy."""
    return FilterOptions(**service.filter_options(session, user_id=user_id))


@router.get("/{transaction_id}", response_model=TransactionDetailOut, summary="Transaction detail")
def get_transaction(
    session: SessionDep,
    user_id: UserDep,
    transaction_id: Annotated[int, Path(ge=1)],
) -> TransactionDetailOut:
    return TransactionDetailOut(
        **service.get_transaction(session, user_id=user_id, transaction_id=transaction_id)
    )
