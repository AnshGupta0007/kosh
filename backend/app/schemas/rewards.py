from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RewardOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str
    kind: Literal["VOUCHER", "CASHBACK", "DONATION", "UPGRADE"]
    coin_cost: int
    value_paise: int
    stock: int | None
    icon: str
    accent: str
    # Server-computed so the client never has to reimplement the rule.
    affordable: bool
    coins_short: int


class BalanceOut(BaseModel):
    balance: int
    lifetime_earned: int
    lifetime_redeemed: int
    coin_value_paise: int  # what one coin is worth, for "≈ ₹x" copy
    earning_transactions: int


class RedeemRequest(BaseModel):
    reward_slug: str = Field(min_length=1, max_length=80)
    # Lets a retried request return the original redemption instead of
    # charging twice — the client sends the same key when it retries.
    idempotency_key: str | None = Field(default=None, max_length=80)


class RedemptionOut(BaseModel):
    id: str
    reward_slug: str
    reward_title: str
    reward_icon: str
    coin_cost: int
    value_paise: int
    voucher_code: str
    status: Literal["CONFIRMED", "REVERSED"]
    created_at: datetime


class RedeemResponse(BaseModel):
    redemption: RedemptionOut
    balance: BalanceOut
    replayed: bool = False


class ErrorOut(BaseModel):
    code: str
    message: str
    detail: dict | None = None
