"""
Shared transaction filter parsing.

The transactions list and the analytics endpoints accept exactly the same
filters — that is what makes the charts and the table agree with each other
when the user cross-filters. Parsing them once, here, is what stops the two
endpoints drifting apart.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Any

from fastapi import Query

IST = timezone(timedelta(hours=5, minutes=30))


def _to_paise(rupees: Decimal | None) -> int | None:
    if rupees is None:
        return None
    return int((rupees * 100).to_integral_value(rounding="ROUND_HALF_UP"))


@dataclass(frozen=True)
class TransactionFilters:
    search: str | None = None
    categories: list[str] = field(default_factory=list)
    statuses: list[str] = field(default_factory=list)
    methods: list[str] = field(default_factory=list)
    merchants: list[str] = field(default_factory=list)
    months: list[str] = field(default_factory=list)
    date_from: date | None = None
    date_to: date | None = None
    min_amount_paise: int | None = None
    max_amount_paise: int | None = None
    flow: str | None = None
    include_quarantined: bool = True

    def where(self) -> tuple[str, dict[str, Any]]:
        """Build the SQL predicate and its bound parameters.

        Every value is bound, never interpolated. The only strings that reach
        the SQL text are column names chosen from a fixed allow-list.
        """
        clauses = ["t.user_id = :user_id"]
        params: dict[str, Any] = {}

        if not self.include_quarantined:
            clauses.append("NOT t.is_quarantined")

        if self.search:
            clauses.append("(m.name ILIKE :search OR t.external_id ILIKE :search)")
            params["search"] = f"%{self.search.strip()}%"

        if self.categories:
            # "Uncategorised" is a real filter target: it selects the rows the
            # loader could not resolve a category for.
            names = [c for c in self.categories if c != "Uncategorised"]
            wants_null = len(names) != len(self.categories)
            parts = []
            if names:
                parts.append("c.name = ANY(:categories)")
                params["categories"] = names
            if wants_null:
                parts.append("t.category_id IS NULL")
            clauses.append(f"({' OR '.join(parts)})")

        if self.statuses:
            clauses.append("t.status = ANY(CAST(:statuses AS transaction_status[]))")
            params["statuses"] = self.statuses

        if self.methods:
            clauses.append("t.method = ANY(CAST(:methods AS payment_method[]))")
            params["methods"] = self.methods

        if self.merchants:
            clauses.append("m.name = ANY(:merchants)")
            params["merchants"] = self.merchants

        if self.months:
            clauses.append(
                "to_char(t.occurred_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') = ANY(:months)"
            )
            params["months"] = self.months

        # Date bounds are the user's calendar days in IST, end-inclusive.
        if self.date_from:
            clauses.append("t.occurred_at >= :date_from")
            params["date_from"] = datetime.combine(self.date_from, time.min, tzinfo=IST)
        if self.date_to:
            clauses.append("t.occurred_at < :date_to")
            params["date_to"] = datetime.combine(
                self.date_to + timedelta(days=1), time.min, tzinfo=IST
            )

        # Amount filters compare magnitude, so a ₹500 refund is found by the
        # same "between ₹400 and ₹600" filter as a ₹500 payment.
        if self.min_amount_paise is not None:
            clauses.append("abs(t.amount_paise) >= :min_amount")
            params["min_amount"] = self.min_amount_paise
        if self.max_amount_paise is not None:
            clauses.append("abs(t.amount_paise) <= :max_amount")
            params["max_amount"] = self.max_amount_paise

        if self.flow in ("DEBIT", "REFUND"):
            clauses.append("t.flow = CAST(:flow AS transaction_flow)")
            params["flow"] = self.flow

        return " AND ".join(clauses), params


def transaction_filters(
    search: Annotated[str | None, Query(max_length=120)] = None,
    category: Annotated[list[str] | None, Query()] = None,
    status: Annotated[list[str] | None, Query()] = None,
    method: Annotated[list[str] | None, Query()] = None,
    merchant: Annotated[list[str] | None, Query()] = None,
    month: Annotated[list[str] | None, Query(description="YYYY-MM, IST buckets")] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    min_amount: Annotated[Decimal | None, Query(ge=0, description="rupees")] = None,
    max_amount: Annotated[Decimal | None, Query(ge=0, description="rupees")] = None,
    flow: Annotated[str | None, Query(pattern="^(DEBIT|REFUND)$")] = None,
) -> TransactionFilters:
    return TransactionFilters(
        search=search or None,
        categories=category or [],
        statuses=status or [],
        methods=method or [],
        merchants=merchant or [],
        months=month or [],
        date_from=date_from,
        date_to=date_to,
        min_amount_paise=_to_paise(min_amount),
        max_amount_paise=_to_paise(max_amount),
        flow=flow,
    )
