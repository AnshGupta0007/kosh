"""Aggregate queries behind the spend analytics screen.

All five aggregates run against the same filtered set as the table, which is
what makes cross-filtering trustworthy: the donut and the table are answering
the same question.

Quarantined rows are excluded here. One corrupt ₹999,999,999 row would
otherwise be 96% of the total and make every chart useless.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.filters import TransactionFilters
from app.repositories.transactions import BASE_FROM

# Months are bucketed in IST — the same expression the index is built on.
MONTH_EXPR = "date_trunc('month', t.occurred_at AT TIME ZONE 'Asia/Kolkata')"


def _params(session: Session, filters: TransactionFilters, user_id: int):
    where, params = filters.where()
    params["user_id"] = user_id
    return where, params


def kpis(session: Session, *, user_id: int, filters: TransactionFilters) -> dict[str, Any]:
    where, params = _params(session, filters, user_id)
    row = session.execute(
        text(
            f"""
            SELECT
                coalesce(sum(t.amount_paise) FILTER (WHERE t.flow = 'DEBIT'), 0)   AS spend,
                coalesce(sum(-t.amount_paise) FILTER (WHERE t.flow = 'REFUND'), 0) AS refunds,
                count(*)                                                           AS txns,
                coalesce(avg(t.amount_paise) FILTER (WHERE t.flow = 'DEBIT'), 0)   AS average,
                coalesce(max(t.amount_paise) FILTER (WHERE t.flow = 'DEBIT'), 0)   AS largest,
                count(*) FILTER (WHERE t.status = 'SUCCESS')                       AS successes,
                count(*) FILTER (WHERE t.status = 'FAILED')                        AS failed,
                count(*) FILTER (WHERE t.status = 'PENDING')                       AS pending,
                coalesce(sum(t.coins_earned), 0)                                   AS coins,
                count(DISTINCT t.merchant_id)                                      AS merchants
            {BASE_FROM}
            WHERE {where}
            """
        ),
        params,
    ).one()

    spend = int(row.spend)
    refunds = int(row.refunds)
    return {
        "total_spend_paise": spend,
        "total_refund_paise": refunds,
        "net_paise": spend - refunds,
        "transaction_count": int(row.txns),
        "average_paise": int(row.average),
        "largest_paise": int(row.largest),
        "success_rate": round(row.successes / row.txns * 100, 1) if row.txns else 0.0,
        "failed_count": int(row.failed),
        "pending_count": int(row.pending),
        "coins_earned": int(row.coins),
        "distinct_merchants": int(row.merchants),
    }


def by_category(session: Session, *, user_id: int, filters: TransactionFilters) -> list[dict]:
    where, params = _params(session, filters, user_id)
    rows = session.execute(
        text(
            f"""
            SELECT
                coalesce(c.name, 'Uncategorised') AS category,
                coalesce(c.slug, 'uncategorised') AS slug,
                coalesce(c.hue, 220)              AS hue,
                sum(t.amount_paise)               AS total,
                count(*)                          AS txns
            {BASE_FROM}
            WHERE {where} AND t.flow = 'DEBIT'
            GROUP BY 1, 2, 3
            ORDER BY total DESC
            """
        ),
        params,
    ).mappings().all()

    grand_total = sum(int(r["total"]) for r in rows) or 1
    return [
        {
            "category": r["category"],
            "slug": r["slug"],
            "hue": int(r["hue"]),
            "total_paise": int(r["total"]),
            "transaction_count": int(r["txns"]),
            "share": round(int(r["total"]) / grand_total * 100, 2),
        }
        for r in rows
    ]


def by_month(session: Session, *, user_id: int, filters: TransactionFilters) -> list[dict]:
    where, params = _params(session, filters, user_id)
    rows = session.execute(
        text(
            f"""
            SELECT
                to_char({MONTH_EXPR}, 'YYYY-MM')  AS month,
                to_char({MONTH_EXPR}, 'Mon ''YY') AS label,
                coalesce(sum(t.amount_paise) FILTER (WHERE t.flow = 'DEBIT'), 0)   AS total,
                coalesce(sum(-t.amount_paise) FILTER (WHERE t.flow = 'REFUND'), 0) AS refunds,
                count(*)                                                           AS txns,
                coalesce(sum(t.coins_earned), 0)                                   AS coins
            {BASE_FROM}
            WHERE {where}
            GROUP BY {MONTH_EXPR}
            ORDER BY {MONTH_EXPR}
            """
        ),
        params,
    ).mappings().all()

    return [
        {
            "month": r["month"],
            "label": r["label"],
            "total_paise": int(r["total"]),
            "refund_paise": int(r["refunds"]),
            "transaction_count": int(r["txns"]),
            "coins_earned": int(r["coins"]),
        }
        for r in rows
    ]


def _named_breakdown(session: Session, where: str, params: dict, column: str, limit: int | None):
    limit_sql = f"LIMIT {int(limit)}" if limit else ""
    rows = session.execute(
        text(
            f"""
            SELECT {column} AS name, sum(t.amount_paise) AS total, count(*) AS txns
            {BASE_FROM}
            WHERE {where} AND t.flow = 'DEBIT'
            GROUP BY 1
            ORDER BY total DESC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()
    return [
        {"name": r["name"], "total_paise": int(r["total"]), "transaction_count": int(r["txns"])}
        for r in rows
    ]


def by_method(session: Session, *, user_id: int, filters: TransactionFilters) -> list[dict]:
    where, params = _params(session, filters, user_id)
    return _named_breakdown(session, where, params, "t.method::text", None)


def top_merchants(
    session: Session, *, user_id: int, filters: TransactionFilters, limit: int = 8
) -> list[dict]:
    where, params = _params(session, filters, user_id)
    return _named_breakdown(session, where, params, "m.name", limit)
