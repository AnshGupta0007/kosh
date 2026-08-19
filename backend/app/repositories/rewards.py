"""Data access for the wallet, the catalogue and redemptions."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def balance(session: Session, *, user_id: int) -> dict[str, Any]:
    """Balance is a SUM over the ledger, never a stored counter."""
    row = session.execute(
        text(
            """
            SELECT
                coalesce(sum(delta), 0)                                  AS balance,
                coalesce(sum(delta) FILTER (WHERE delta > 0), 0)         AS earned,
                coalesce(-sum(delta) FILTER (WHERE delta < 0), 0)        AS redeemed,
                count(*) FILTER (WHERE kind = 'EARN')                    AS earning_txns
            FROM coin_ledger
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).one()
    return {
        "balance": int(row.balance),
        "lifetime_earned": int(row.earned),
        "lifetime_redeemed": int(row.redeemed),
        "earning_transactions": int(row.earning_txns),
    }


def lock_user(session: Session, *, user_id: int) -> None:
    """Serialise concurrent redeems for one user.

    Two redeems racing on the last 3,000 coins must not both succeed, so the
    user row is locked for the duration of the transaction. Postgres does the
    hard part; the service layer just has to ask.
    """
    session.execute(
        text("SELECT id FROM users WHERE id = :user_id FOR UPDATE"), {"user_id": user_id}
    ).one()


def catalogue(session: Session) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            """
            SELECT id, slug, title, description, kind::text AS kind, coin_cost,
                   value_paise, stock, icon, accent
            FROM rewards
            WHERE is_active
            ORDER BY sort_order, coin_cost
            """
        )
    ).mappings().all()
    return [dict(r) for r in rows]


def get_reward(session: Session, *, slug: str) -> dict[str, Any] | None:
    row = session.execute(
        text(
            """
            SELECT id, slug, title, description, kind::text AS kind, coin_cost,
                   value_paise, stock, icon, accent, is_active
            FROM rewards
            WHERE slug = :slug
            """
        ),
        {"slug": slug},
    ).mappings().one_or_none()
    return dict(row) if row else None


def find_by_idempotency_key(
    session: Session, *, user_id: int, key: str
) -> dict[str, Any] | None:
    row = session.execute(
        text(
            """
            SELECT r.id::text AS id, rw.slug AS reward_slug, rw.title AS reward_title,
                   rw.icon AS reward_icon, r.coin_cost, rw.value_paise,
                   r.voucher_code, r.status::text AS status, r.created_at
            FROM redemptions r
            JOIN rewards rw ON rw.id = r.reward_id
            WHERE r.user_id = :user_id AND r.idempotency_key = :key
            """
        ),
        {"user_id": user_id, "key": key},
    ).mappings().one_or_none()
    return dict(row) if row else None


def insert_redemption(
    session: Session,
    *,
    user_id: int,
    reward: dict[str, Any],
    voucher_code: str,
    idempotency_key: str | None,
) -> dict[str, Any]:
    redemption_id = session.execute(
        text(
            """
            INSERT INTO redemptions (user_id, reward_id, coin_cost, voucher_code, idempotency_key)
            VALUES (:user_id, :reward_id, :coin_cost, :voucher_code, :idempotency_key)
            RETURNING id
            """
        ),
        {
            "user_id": user_id,
            "reward_id": reward["id"],
            "coin_cost": reward["coin_cost"],
            "voucher_code": voucher_code,
            "idempotency_key": idempotency_key,
        },
    ).scalar_one()

    session.execute(
        text(
            """
            INSERT INTO coin_ledger (user_id, delta, kind, redemption_id, note)
            VALUES (:user_id, :delta, 'REDEEM', :redemption_id, :note)
            """
        ),
        {
            "user_id": user_id,
            "delta": -reward["coin_cost"],
            "redemption_id": redemption_id,
            "note": f"Redeemed {reward['title']}",
        },
    )

    if reward["stock"] is not None:
        session.execute(
            text("UPDATE rewards SET stock = stock - 1 WHERE id = :id AND stock > 0"),
            {"id": reward["id"]},
        )

    row = session.execute(
        text(
            """
            SELECT id::text AS id, coin_cost, voucher_code, status::text AS status, created_at
            FROM redemptions WHERE id = :id
            """
        ),
        {"id": redemption_id},
    ).mappings().one()
    return dict(row)


def history(session: Session, *, user_id: int, limit: int = 20) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            """
            SELECT r.id::text AS id, rw.slug AS reward_slug, rw.title AS reward_title,
                   rw.icon AS reward_icon, r.coin_cost, rw.value_paise,
                   r.voucher_code, r.status::text AS status, r.created_at
            FROM redemptions r
            JOIN rewards rw ON rw.id = r.reward_id
            WHERE r.user_id = :user_id
            ORDER BY r.created_at DESC
            LIMIT :limit
            """
        ),
        {"user_id": user_id, "limit": limit},
    ).mappings().all()
    return [dict(r) for r in rows]
