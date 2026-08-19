"""
Test fixtures.

Tests run against a real PostgreSQL database (a throwaway `kosh_test`,
created on the fly), not a stub. The schema is the thing under test as much
as the Python is — enum types, check constraints and the partial unique
index on the ledger are all load-bearing, and none of them exist in SQLite.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

ADMIN_URL = os.getenv("TEST_ADMIN_URL", "postgresql://kosh:kosh@localhost:5433/postgres")
TEST_DB = os.getenv("TEST_DB_NAME", "kosh_test")
TEST_URL = os.getenv(
    "TEST_DATABASE_URL", f"postgresql+psycopg://kosh:kosh@localhost:5433/{TEST_DB}"
)

# Must be set before app.core.config is imported anywhere.
os.environ["DATABASE_URL"] = TEST_URL

from app.db.session import engine  # noqa: E402
from app.seed.catalogue import CATEGORIES, REWARDS  # noqa: E402
from app.seed.run import SCHEMA_PATH  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))


def _ensure_database() -> None:
    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{TEST_DB}"')


@pytest.fixture(scope="session", autouse=True)
def database() -> None:
    _ensure_database()


@pytest.fixture
def session(database):
    """A clean schema plus a small, hand-written fixture set for every test."""
    from sqlalchemy import text

    from app.db.session import SessionLocal

    with engine.begin() as conn:
        conn.exec_driver_sql(SCHEMA_PATH.read_text())

    db = SessionLocal()
    user_id = db.execute(
        text("INSERT INTO users (email, display_name) VALUES (:e, 'Test User') RETURNING id"),
        {"e": "demo@kosh.app"},
    ).scalar_one()

    category_ids = {}
    for slug, name, hue, order in CATEGORIES[:4]:
        category_ids[name] = db.execute(
            text(
                "INSERT INTO categories (slug, name, hue, sort_order)"
                " VALUES (:s, :n, :h, :o) RETURNING id"
            ),
            {"s": slug, "n": name, "h": hue, "o": order},
        ).scalar_one()

    merchant_ids = {}
    for merchant in ("Swiggy", "IndiGo", "DMart"):
        merchant_ids[merchant] = db.execute(
            text("INSERT INTO merchants (name) VALUES (:n) RETURNING id"), {"n": merchant}
        ).scalar_one()

    base = datetime(2026, 3, 10, 12, 0, tzinfo=IST)
    rows = [
        # merchant,   category,        rupees,  status,    method,     days ago
        ("Swiggy", "Food & Dining", 450.00, "SUCCESS", "UPI", 0),
        ("Swiggy", "Food & Dining", 1250.50, "SUCCESS", "CREDIT_CARD", 40),
        ("IndiGo", "Travel", 12500.00, "SUCCESS", "CREDIT_CARD", 5),
        ("IndiGo", "Travel", 8000.00, "FAILED", "NETBANKING", 12),
        ("DMart", "Groceries", 3200.00, "PENDING", "DEBIT_CARD", 3),
        ("DMart", "Groceries", -500.00, "SUCCESS", "UPI", 1),
    ]
    for i, (merchant, category, rupees, status, method, days) in enumerate(rows):
        paise = int(rupees * 100)
        coins = min(paise // 10000, 100) if status == "SUCCESS" and paise > 0 else 0
        db.execute(
            text(
                """
                INSERT INTO transactions (external_id, user_id, occurred_at, merchant_id,
                    category_id, amount_paise, status, method, flow, coins_earned, source_row)
                VALUES (:eid, :uid, :ts, :mid, :cid, :amt, :status, :method, :flow, :coins,
                        '{}'::jsonb)
                """
            ),
            {
                "eid": f"TXNTEST{i:04d}",
                "uid": user_id,
                "ts": base - timedelta(days=days),
                "mid": merchant_ids[merchant],
                "cid": category_ids[category],
                "amt": paise,
                "status": status,
                "method": method,
                "flow": "REFUND" if paise < 0 else "DEBIT",
                "coins": coins,
            },
        )

    db.execute(
        text(
            """
            INSERT INTO coin_ledger (user_id, delta, kind, transaction_id, note)
            SELECT user_id, coins_earned, 'EARN', id, 'seed' FROM transactions
            WHERE coins_earned > 0
            """
        )
    )

    # A joining bonus, so the fixture user can actually afford something.
    # Keeps the balance a round, obvious number in assertions.
    db.execute(
        text(
            """
            INSERT INTO coin_ledger (user_id, delta, kind, note)
            VALUES (:uid, 30000, 'GRANT', 'Welcome bonus')
            """
        ),
        {"uid": user_id},
    )

    for reward in REWARDS:
        db.execute(
            text(
                """
                INSERT INTO rewards (slug, title, description, kind, coin_cost, value_paise,
                                     stock, icon, accent, sort_order)
                VALUES (:slug, :title, :description, :kind, :coin_cost, :value_paise,
                        :stock, :icon, :accent, :sort_order)
                """
            ),
            reward,
        )
    db.commit()

    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(session):
    from fastapi.testclient import TestClient

    from app.db.session import get_session
    from app.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def user_id(session) -> int:
    from sqlalchemy import text

    return session.execute(text("SELECT id FROM users LIMIT 1")).scalar_one()
