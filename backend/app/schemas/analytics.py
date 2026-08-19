from __future__ import annotations

from pydantic import BaseModel


class CategorySlice(BaseModel):
    category: str
    slug: str
    hue: int
    total_paise: int
    transaction_count: int
    share: float


class MonthPoint(BaseModel):
    month: str  # YYYY-MM, bucketed in IST
    label: str  # "Mar 26"
    total_paise: int
    refund_paise: int
    transaction_count: int
    coins_earned: int


class NamedSlice(BaseModel):
    name: str
    total_paise: int
    transaction_count: int


class Kpis(BaseModel):
    total_spend_paise: int
    total_refund_paise: int
    net_paise: int
    transaction_count: int
    average_paise: int
    largest_paise: int
    success_rate: float
    failed_count: int
    pending_count: int
    coins_earned: int
    distinct_merchants: int


class AnalyticsOut(BaseModel):
    kpis: Kpis
    by_category: list[CategorySlice]
    by_month: list[MonthPoint]
    by_method: list[NamedSlice]
    top_merchants: list[NamedSlice]
    query_ms: int
