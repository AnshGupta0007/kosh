"""
The redeem endpoint is the one place in this app where being wrong costs a
user something real, so it gets the most tests: it must reject what it
should reject, and it must never charge twice.
"""

from __future__ import annotations

from sqlalchemy import text


def balance_of(client) -> int:
    return client.get("/api/wallet/balance").json()["balance"]


def test_redeem_debits_exactly_once(client, session):
    before = balance_of(client)

    response = client.post("/api/rewards/redeem", json={"reward_slug": "swiggy-250"})

    assert response.status_code == 201
    body = response.json()
    assert body["redemption"]["reward_slug"] == "swiggy-250"
    assert body["redemption"]["voucher_code"].startswith("KOSH-")
    assert body["balance"]["balance"] == before - 2500
    assert balance_of(client) == before - 2500

    # The debit is a ledger entry, not an UPDATE of a counter.
    entries = session.execute(
        text("SELECT delta, kind::text FROM coin_ledger WHERE kind = 'REDEEM'")
    ).all()
    assert entries == [(-2500, "REDEEM")]


def test_redeem_rejects_unaffordable_reward_and_leaves_balance_untouched(client):
    before = balance_of(client)

    response = client.post(
        "/api/rewards/redeem", json={"reward_slug": "statement-cashback-50k"}
    )

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "INSUFFICIENT_COINS"
    assert body["detail"]["coins_short"] == 500000 - before
    # The important half of the assertion: a rejected redeem changes nothing.
    assert balance_of(client) == before


def test_redeem_rejects_unknown_reward(client):
    before = balance_of(client)

    response = client.post("/api/rewards/redeem", json={"reward_slug": "free-yacht"})

    assert response.status_code == 404
    assert response.json()["code"] == "REWARD_NOT_FOUND"
    assert balance_of(client) == before


def test_redeem_is_idempotent_under_retry(client):
    """A client that retries after a timeout must not be charged twice."""
    before = balance_of(client)
    payload = {"reward_slug": "swiggy-250", "idempotency_key": "retry-me"}

    first = client.post("/api/rewards/redeem", json=payload)
    second = client.post("/api/rewards/redeem", json=payload)

    assert first.status_code == second.status_code == 201
    assert first.json()["replayed"] is False
    assert second.json()["replayed"] is True
    # Same voucher returned, and only one debit.
    assert first.json()["redemption"]["voucher_code"] == (
        second.json()["redemption"]["voucher_code"]
    )
    assert balance_of(client) == before - 2500


def test_redeem_rejects_missing_slug(client):
    assert client.post("/api/rewards/redeem", json={}).status_code == 422


def test_redeem_decrements_limited_stock(client, session):
    stock_before = session.execute(
        text("SELECT stock FROM rewards WHERE slug = 'movie-night'")
    ).scalar_one()

    client.post("/api/rewards/redeem", json={"reward_slug": "movie-night"})

    stock_after = session.execute(
        text("SELECT stock FROM rewards WHERE slug = 'movie-night'")
    ).scalar_one()
    assert stock_after == stock_before - 1


def test_catalogue_reports_affordability_from_the_server(client):
    rewards = {r["slug"]: r for r in client.get("/api/rewards").json()}

    assert rewards["swiggy-250"]["affordable"] is True
    assert rewards["statement-cashback-50k"]["affordable"] is False
    assert rewards["statement-cashback-50k"]["coins_short"] > 0
