"""Rewards and redemption business logic."""

from __future__ import annotations

import secrets
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import InsufficientCoins, RewardNotFound, RewardUnavailable
from app.repositories import rewards as repo

# One coin is worth ₹0.10, so the catalogue prices out at roughly 1% back on
# spend — the same ballpark as a real rewards card.
COIN_VALUE_PAISE = 10


def _voucher_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no look-alike characters
    body = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"KOSH-{body[:4]}-{body[4:]}"


def get_balance(session: Session, *, user_id: int) -> dict[str, Any]:
    return {**repo.balance(session, user_id=user_id), "coin_value_paise": COIN_VALUE_PAISE}


def list_rewards(session: Session, *, user_id: int) -> list[dict[str, Any]]:
    current = repo.balance(session, user_id=user_id)["balance"]
    return [
        {
            **reward,
            "affordable": current >= reward["coin_cost"] and reward["stock"] != 0,
            "coins_short": max(0, reward["coin_cost"] - current),
        }
        for reward in repo.catalogue(session)
    ]


def redeem(
    session: Session, *, user_id: int, reward_slug: str, idempotency_key: str | None
) -> dict[str, Any]:
    """Redeem a reward. Either the ledger entry and the redemption both land,
    or neither does — the whole thing is one database transaction.
    """
    # Serialise concurrent redeems for this user before reading the balance,
    # otherwise two requests can both see enough coins and both succeed.
    repo.lock_user(session, user_id=user_id)

    if idempotency_key:
        existing = repo.find_by_idempotency_key(session, user_id=user_id, key=idempotency_key)
        if existing:
            session.commit()
            return {
                "redemption": existing,
                "balance": get_balance(session, user_id=user_id),
                "replayed": True,
            }

    reward = repo.get_reward(session, slug=reward_slug)
    if reward is None or not reward["is_active"]:
        raise RewardNotFound(
            f"No active reward with slug {reward_slug!r}.", {"reward_slug": reward_slug}
        )

    if reward["stock"] is not None and reward["stock"] <= 0:
        raise RewardUnavailable(f"{reward['title']} is out of stock.", {"reward_slug": reward_slug})

    current = repo.balance(session, user_id=user_id)["balance"]
    if current < reward["coin_cost"]:
        raise InsufficientCoins(
            f"You need {reward['coin_cost'] - current:,} more coins to redeem "
            f"{reward['title']}.",
            {
                "balance": current,
                "coin_cost": reward["coin_cost"],
                "coins_short": reward["coin_cost"] - current,
            },
        )

    created = repo.insert_redemption(
        session,
        user_id=user_id,
        reward=reward,
        voucher_code=_voucher_code(),
        idempotency_key=idempotency_key,
    )
    session.commit()

    return {
        "redemption": {
            **created,
            "reward_slug": reward["slug"],
            "reward_title": reward["title"],
            "reward_icon": reward["icon"],
            "value_paise": reward["value_paise"],
        },
        "balance": get_balance(session, user_id=user_id),
        "replayed": False,
    }


def list_history(session: Session, *, user_id: int) -> list[dict[str, Any]]:
    return repo.history(session, user_id=user_id)


def coin_rule() -> dict[str, int]:
    return {
        "rupees_per_coin": settings.coins_per_rupee_divisor,
        "cap_per_transaction": settings.coin_cap_per_transaction,
        "coin_value_paise": COIN_VALUE_PAISE,
    }
