"""Request and response models for the transactions API."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class SortField(StrEnum):
    occurred_at = "occurred_at"
    amount = "amount"
    merchant = "merchant"
    coins = "coins"


class SortOrder(StrEnum):
    asc = "asc"
    desc = "desc"


class TransactionOut(BaseModel):
    id: int
    external_id: str
    occurred_at: datetime
    merchant: str
    category: str | None
    amount_paise: int
    currency: str
    status: Literal["SUCCESS", "PENDING", "FAILED"]
    method: Literal["UPI", "CREDIT_CARD", "DEBIT_CARD", "NETBANKING"]
    flow: Literal["DEBIT", "REFUND"]
    coins_earned: int
    quality_flags: list[str]
    is_quarantined: bool


class TransactionDetailOut(TransactionOut):
    """Adds provenance, shown in the detail drawer."""

    source_row: dict[str, Any]
    merchant_category: str | None = None


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    meta: PageMeta
    # Totals for the *filtered* set, not just the visible page, so the header
    # can show "₹4.2L across 812 payments" without a second round trip.
    filtered_total_paise: int
    filtered_refund_paise: int
    query_ms: int = Field(description="Server-side query time, surfaced in the UI footer.")


class FilterOptions(BaseModel):
    categories: list[str]
    merchants: list[str]
    statuses: list[str]
    methods: list[str]
    min_amount_paise: int
    max_amount_paise: int
    earliest: datetime | None
    latest: datetime | None
