"""
One-command seed: create the schema, normalise transactions.json, load it.

    python -m app.seed.run                 # uses ../data/transactions.json
    python -m app.seed.run --file path.json

Safe to re-run: the schema script drops and recreates everything, so the
command is idempotent by construction.
"""

from __future__ import annotations

import argparse
import json
import time
from collections import Counter
from pathlib import Path
from typing import Any

from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal, engine
from app.seed import etl
from app.seed.catalogue import CATEGORIES, REWARDS

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
SCHEMA_PATH = BACKEND_DIR / "app" / "db" / "schema.sql"
DEFAULT_DATA = REPO_ROOT / "data" / "transactions.json"


def _log(message: str) -> None:
    print(f"  {message}", flush=True)


def apply_schema() -> None:
    sql = SCHEMA_PATH.read_text()
    with engine.begin() as conn:
        conn.exec_driver_sql(sql)
    _log(f"schema applied from {SCHEMA_PATH.relative_to(REPO_ROOT)}")


def seed(path: Path) -> None:
    started = time.perf_counter()
    rows: list[dict[str, Any]] = json.loads(path.read_text())
    _log(f"read {len(rows):,} rows from {path.name}")

    merchant_map = etl.build_merchant_category_map(rows)
    id_counts = Counter(str(r.get("id")) for r in rows)
    duplicate_ids = {rid for rid, n in id_counts.items() if n > 1}

    normalised: list[etl.NormalisedRow] = []
    rejected: list[tuple[dict[str, Any], str]] = []
    for row in rows:
        try:
            normalised.append(
                etl.normalise_row(
                    row,
                    merchant_map,
                    quarantine_amount_paise=settings.quarantine_amount_paise,
                    divisor_rupees=settings.coins_per_rupee_divisor,
                    cap=settings.coin_cap_per_transaction,
                    duplicate_ids=duplicate_ids,
                )
            )
        except etl.RowRejected as exc:
            rejected.append((row, str(exc)))

    session = SessionLocal()
    try:
        user_id = session.execute(
            text(
                """
                INSERT INTO users (email, display_name)
                VALUES (:email, :name)
                RETURNING id
                """
            ),
            {"email": settings.demo_user_email, "name": settings.demo_user_name},
        ).scalar_one()

        # --- reference data -------------------------------------------------
        category_ids: dict[str, int] = {}
        for slug, name, hue, order in CATEGORIES:
            category_ids[name] = session.execute(
                text(
                    """
                    INSERT INTO categories (slug, name, hue, sort_order)
                    VALUES (:slug, :name, :hue, :order)
                    RETURNING id
                    """
                ),
                {"slug": slug, "name": name, "hue": hue, "order": order},
            ).scalar_one()

        # Any category present in the file but not in our canonical list still
        # gets a row, so nothing is dropped just because we did not expect it.
        for row in normalised:
            if row.category and row.category not in category_ids:
                category_ids[row.category] = session.execute(
                    text(
                        """
                        INSERT INTO categories (slug, name, hue, sort_order)
                        VALUES (:slug, :name, 210, 200)
                        RETURNING id
                        """
                    ),
                    {"slug": row.category.lower().replace(" & ", "-").replace(" ", "-"),
                     "name": row.category},
                ).scalar_one()

        merchant_ids: dict[str, int] = {}
        for merchant in sorted({row.merchant for row in normalised}):
            default_category = merchant_map.get(merchant)
            merchant_ids[merchant] = session.execute(
                text(
                    """
                    INSERT INTO merchants (name, default_category_id)
                    VALUES (:name, :category_id)
                    RETURNING id
                    """
                ),
                {"name": merchant, "category_id": category_ids.get(default_category)},
            ).scalar_one()
        _log(f"loaded {len(category_ids)} categories, {len(merchant_ids)} merchants")

        # --- transactions ---------------------------------------------------
        payload = [
            {
                "external_id": row.external_id,
                "user_id": user_id,
                "occurred_at": row.occurred_at,
                "merchant_id": merchant_ids[row.merchant],
                "category_id": category_ids.get(row.category) if row.category else None,
                "amount_paise": row.amount_paise,
                "currency": row.currency,
                "status": row.status,
                "method": row.method,
                "flow": row.flow,
                "coins_earned": row.coins_earned,
                "quality_flags": row.flags,
                "is_quarantined": row.is_quarantined,
                "source_row": json.dumps(row.source_row),
            }
            for row in normalised
        ]
        session.execute(
            text(
                """
                INSERT INTO transactions (
                    external_id, user_id, occurred_at, merchant_id, category_id,
                    amount_paise, currency, status, method, flow, coins_earned,
                    quality_flags, is_quarantined, source_row
                ) VALUES (
                    :external_id, :user_id, :occurred_at, :merchant_id, :category_id,
                    :amount_paise, :currency, :status, :method, :flow, :coins_earned,
                    :quality_flags, :is_quarantined, CAST(:source_row AS jsonb)
                )
                """
            ),
            payload,
        )
        _log(f"loaded {len(payload):,} transactions")

        # --- coin ledger ----------------------------------------------------
        # One EARN entry per coin-earning transaction. Written from the
        # transactions themselves so the ledger can always be reconciled.
        earned = session.execute(
            text(
                """
                INSERT INTO coin_ledger (user_id, delta, kind, transaction_id, note)
                SELECT user_id, coins_earned, 'EARN', id,
                       'Earned on payment ' || external_id
                FROM transactions
                WHERE coins_earned > 0
                RETURNING delta
                """
            )
        ).scalars().all()
        _log(f"minted {sum(earned):,} coins across {len(earned):,} ledger entries")

        # --- rewards --------------------------------------------------------
        for reward in REWARDS:
            session.execute(
                text(
                    """
                    INSERT INTO rewards (slug, title, description, kind, coin_cost,
                                         value_paise, stock, icon, accent, sort_order)
                    VALUES (:slug, :title, :description, :kind, :coin_cost,
                            :value_paise, :stock, :icon, :accent, :sort_order)
                    """
                ),
                reward,
            )
        _log(f"loaded {len(REWARDS)} rewards")

        # --- data quality report --------------------------------------------
        duration_ms = int((time.perf_counter() - started) * 1000)
        run_id = session.execute(
            text(
                """
                INSERT INTO ingestion_runs (
                    source_file, finished_at, rows_in, rows_loaded,
                    rows_repaired, rows_quarantined, duration_ms
                ) VALUES (
                    :source_file, now(), :rows_in, :rows_loaded,
                    :rows_repaired, :rows_quarantined, :duration_ms
                ) RETURNING id
                """
            ),
            {
                "source_file": path.name,
                "rows_in": len(rows),
                "rows_loaded": len(normalised),
                "rows_repaired": sum(1 for r in normalised if r.flags),
                "rows_quarantined": sum(1 for r in normalised if r.is_quarantined),
                "duration_ms": duration_ms,
            },
        ).scalar_one()

        for issue in build_issue_report(normalised, rejected, duplicate_ids):
            session.execute(
                text(
                    """
                    INSERT INTO data_quality_issues (
                        run_id, code, label, detail, resolution, severity, row_count, samples
                    ) VALUES (
                        :run_id, :code, :label, :detail, :resolution, :severity,
                        :row_count, CAST(:samples AS jsonb)
                    )
                    """
                ),
                {"run_id": run_id, **issue},
            )

        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    _log(f"done in {int((time.perf_counter() - started) * 1000):,} ms")


ISSUE_COPY = {
    etl.FLAG_TIMESTAMP_EPOCH: (
        "Epoch timestamps",
        "Timestamps stored as Unix milliseconds instead of a date string.",
        "Converted to UTC timestamptz on load.",
        "REPAIRED",
    ),
    etl.FLAG_TIMESTAMP_DMY: (
        "Day-first timestamps",
        "dd/mm/yyyy values, confirmed day-first by dates such as 31/12/2025.",
        "Parsed as IST day-first and stored as UTC.",
        "REPAIRED",
    ),
    etl.FLAG_TIMESTAMP_DATE_ONLY: (
        "Date-only timestamps",
        "Rows with a calendar date but no clock time.",
        "Anchored to 00:00 IST so the row stays on the date the file claims.",
        "REPAIRED",
    ),
    etl.FLAG_TIMESTAMP_OFFSET: (
        "Local-offset timestamps",
        "ISO timestamps carrying a +05:30 offset rather than UTC.",
        "Converted to UTC; the offset is preserved in the source record.",
        "INFO",
    ),
    etl.FLAG_AMOUNT_STRING: (
        "Amounts as strings",
        'Amounts encoded as text, for example "5065.00".',
        "Parsed with Decimal and stored as integer paise.",
        "REPAIRED",
    ),
    etl.FLAG_AMOUNT_NEGATIVE: (
        "Negative amounts",
        "Negative values sitting alongside ordinary payments.",
        "Treated as refunds: kept, marked as inflow, and they earn no coins.",
        "REPAIRED",
    ),
    etl.FLAG_AMOUNT_OUTLIER: (
        "Implausible amounts",
        "Amounts at or above ₹1 crore on a consumer credit card.",
        "Quarantined: visible in the table, excluded from analytics and coins.",
        "QUARANTINED",
    ),
    etl.FLAG_CATEGORY_BACKFILLED: (
        "Missing categories",
        "Rows with a null or empty category.",
        "Backfilled from the merchant's dominant category learned from the file.",
        "REPAIRED",
    ),
    etl.FLAG_CATEGORY_UNRESOLVED: (
        "Uncategorisable rows",
        "Rows with no category and a merchant we could not infer one from.",
        "Left uncategorised rather than guessed; shown as Uncategorised.",
        "INFO",
    ),
    etl.FLAG_STATUS_CASING: (
        "Inconsistent status casing",
        'Rows using "success" instead of "SUCCESS".',
        "Normalised to the canonical enum value.",
        "REPAIRED",
    ),
    etl.FLAG_DUPLICATE_ID: (
        "Reused transaction ids",
        "Ids shared by two genuinely different payments (different merchant, amount and date).",
        "Both kept under a surrogate primary key; the source id is not unique.",
        "INFO",
    ),
}


def build_issue_report(
    normalised: list[etl.NormalisedRow],
    rejected: list[tuple[dict[str, Any], str]],
    duplicate_ids: set[str],
) -> list[dict[str, Any]]:
    counts = Counter(flag for row in normalised for flag in row.flags)
    samples: dict[str, list[dict[str, Any]]] = {}
    for row in normalised:
        for flag in row.flags:
            bucket = samples.setdefault(flag, [])
            if len(bucket) < 3:
                bucket.append(row.source_row)

    issues = []
    for code, count in counts.most_common():
        label, detail, resolution, severity = ISSUE_COPY[code]
        issues.append(
            {
                "code": code,
                "label": label,
                "detail": detail,
                "resolution": resolution,
                "severity": severity,
                "row_count": count,
                "samples": json.dumps(samples.get(code, [])),
            }
        )

    if rejected:
        issues.append(
            {
                "code": "ROW_REJECTED",
                "label": "Unloadable rows",
                "detail": "Rows missing a field we cannot invent, such as an id or an amount.",
                "resolution": "Not loaded. Listed here rather than dropped silently.",
                "severity": "QUARANTINED",
                "row_count": len(rejected),
                "samples": json.dumps([row for row, _ in rejected[:3]]),
            }
        )
    return issues


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the Kosh schema and load the dataset.")
    parser.add_argument("--file", type=Path, default=DEFAULT_DATA)
    args = parser.parse_args()

    if not args.file.exists():
        raise SystemExit(f"dataset not found at {args.file}")

    print("\nKosh seed")
    print("─" * 52)
    apply_schema()
    seed(args.file)
    print("─" * 52)
    print("Ready. Start the API with: uvicorn app.main:app --reload\n")


if __name__ == "__main__":
    main()
