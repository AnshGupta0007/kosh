"""Data access for transactions. SQL lives here and nowhere else."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.filters import TransactionFilters

BASE_FROM = """
    FROM transactions t
    JOIN merchants  m ON m.id = t.merchant_id
    LEFT JOIN categories c ON c.id = t.category_id
"""

# Sorting is column-allow-listed. A user-supplied string never reaches the
# ORDER BY clause.
SORT_COLUMNS = {
    "occurred_at": "t.occurred_at",
    "amount": "abs(t.amount_paise)",
    "merchant": "m.name",
    "coins": "t.coins_earned",
}

SELECT_COLUMNS = """
    t.id,
    t.external_id,
    t.occurred_at,
    m.name  AS merchant,
    c.name  AS category,
    t.amount_paise,
    t.currency,
    t.status::text AS status,
    t.method::text AS method,
    t.flow::text   AS flow,
    t.coins_earned,
    t.quality_flags,
    t.is_quarantined
"""


def list_page(
    session: Session,
    *,
    user_id: int,
    filters: TransactionFilters,
    sort: str,
    order: str,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, Any]], int, int, int]:
    """Return (rows, total_matching, total_paise, refund_paise).

    Pagination, filtering and sorting all happen in Postgres; the browser
    only ever receives one page.
    """
    where, params = filters.where()
    params["user_id"] = user_id

    sort_column = SORT_COLUMNS.get(sort, SORT_COLUMNS["occurred_at"])
    direction = "ASC" if order == "asc" else "DESC"
    # t.id is the tiebreaker so paging is stable when many rows share a value.
    order_by = f"{sort_column} {direction} NULLS LAST, t.id {direction}"

    rows = session.execute(
        text(
            f"""
            SELECT {SELECT_COLUMNS}
            {BASE_FROM}
            WHERE {where}
            ORDER BY {order_by}
            LIMIT :limit OFFSET :offset
            """
        ),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).mappings().all()

    totals = session.execute(
        text(
            f"""
            SELECT
                count(*)                                                       AS total,
                coalesce(sum(t.amount_paise) FILTER (
                    WHERE t.flow = 'DEBIT' AND NOT t.is_quarantined), 0)       AS spend,
                coalesce(sum(-t.amount_paise) FILTER (
                    WHERE t.flow = 'REFUND'), 0)                               AS refunds
            {BASE_FROM}
            WHERE {where}
            """
        ),
        params,
    ).one()

    return [dict(r) for r in rows], totals.total, int(totals.spend), int(totals.refunds)


def get_by_id(session: Session, *, user_id: int, transaction_id: int) -> dict[str, Any] | None:
    row = session.execute(
        text(
            f"""
            SELECT {SELECT_COLUMNS},
                   t.source_row,
                   mc.name AS merchant_category
            {BASE_FROM}
            LEFT JOIN categories mc ON mc.id = m.default_category_id
            WHERE t.id = :transaction_id AND t.user_id = :user_id
            """
        ),
        {"transaction_id": transaction_id, "user_id": user_id},
    ).mappings().one_or_none()
    return dict(row) if row else None


def filter_options(session: Session, *, user_id: int) -> dict[str, Any]:
    categories = session.execute(
        text(
            """
            SELECT c.name
            FROM categories c
            WHERE EXISTS (SELECT 1 FROM transactions t WHERE t.category_id = c.id)
            ORDER BY c.sort_order, c.name
            """
        )
    ).scalars().all()

    has_uncategorised = session.execute(
        text("SELECT EXISTS (SELECT 1 FROM transactions WHERE category_id IS NULL)")
    ).scalar_one()
    if has_uncategorised:
        categories = [*categories, "Uncategorised"]

    merchants = session.execute(
        text(
            """
            SELECT m.name
            FROM merchants m
            WHERE EXISTS (SELECT 1 FROM transactions t WHERE t.merchant_id = m.id)
            ORDER BY m.name
            """
        )
    ).scalars().all()

    bounds = session.execute(
        text(
            """
            SELECT
                coalesce(min(abs(amount_paise)) FILTER (WHERE NOT is_quarantined), 0) AS lo,
                coalesce(max(abs(amount_paise)) FILTER (WHERE NOT is_quarantined), 0) AS hi,
                min(occurred_at) AS earliest,
                max(occurred_at) AS latest
            FROM transactions
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).one()

    return {
        "categories": list(categories),
        "merchants": list(merchants),
        "statuses": ["SUCCESS", "PENDING", "FAILED"],
        "methods": ["UPI", "CREDIT_CARD", "DEBIT_CARD", "NETBANKING"],
        "min_amount_paise": int(bounds.lo),
        "max_amount_paise": int(bounds.hi),
        "earliest": bounds.earliest,
        "latest": bounds.latest,
    }
