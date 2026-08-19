"""
Unit tests for the normalisation rules — no database, just the messy values
that are actually present in the supplied file.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.seed import etl


def parse(value):
    flags: list[str] = []
    return etl.parse_timestamp(value, flags), flags


@pytest.mark.parametrize(
    ("raw", "expected_iso"),
    [
        ("2025-10-03T21:03:27Z", "2025-10-03T21:03:27+00:00"),
        ("2026-03-25T06:08:03+05:30", "2026-03-25T00:38:03+00:00"),
        ("12/10/2025 16:24:49", "2025-10-12T10:54:49+00:00"),  # day-first
        ("2025-07-03", "2025-07-02T18:30:00+00:00"),  # IST midnight
    ],
)
def test_every_observed_timestamp_shape_lands_on_utc(raw, expected_iso):
    parsed, _ = parse(raw)
    assert parsed.tzinfo is not None
    assert parsed.utcoffset().total_seconds() == 0
    assert parsed.isoformat() == expected_iso


def test_epoch_millis_are_read_as_millis_not_seconds():
    parsed, flags = parse("1768265109000")
    assert etl.FLAG_TIMESTAMP_EPOCH in flags
    assert parsed == datetime.fromtimestamp(1768265109, tz=UTC)


def test_day_first_dates_are_not_read_as_month_first():
    """31/12/2025 is only parseable day-first, which fixes the format for all."""
    parsed, flags = parse("31/12/2025 08:55:58")
    assert etl.FLAG_TIMESTAMP_DMY in flags
    assert (parsed.year, parsed.month, parsed.day) == (2025, 12, 31)


def test_string_amounts_become_exact_paise():
    flags: list[str] = []
    assert etl.parse_amount_paise("5065.00", flags) == 506500
    assert etl.FLAG_AMOUNT_STRING in flags


def test_float_amounts_do_not_lose_a_paisa_to_binary_rounding():
    # 912.62 is not representable in binary floating point; int(912.62 * 100)
    # is 91261. Decimal keeps it honest.
    assert etl.parse_amount_paise(912.62, []) == 91262


def test_negative_amounts_are_flagged_as_refunds():
    flags: list[str] = []
    assert etl.parse_amount_paise(-477.46, flags) == -47746
    assert etl.FLAG_AMOUNT_NEGATIVE in flags


def test_status_casing_is_normalised_and_flagged():
    flags: list[str] = []
    assert etl.normalise_status("success", flags) == "SUCCESS"
    assert etl.FLAG_STATUS_CASING in flags
    assert etl.normalise_status("SUCCESS", []) == "SUCCESS"


def test_unparseable_rows_are_rejected_rather_than_guessed():
    with pytest.raises(etl.RowRejected):
        etl.normalise_status("dunno", [])
    with pytest.raises(etl.RowRejected):
        etl.parse_amount_paise("not-a-number", [])


def test_missing_category_is_backfilled_from_the_merchants_own_history():
    rows = [
        {"merchant": "Zepto", "category": "Groceries"},
        {"merchant": "Zepto", "category": "Groceries"},
        {"merchant": "Zepto", "category": "Shopping"},
    ]
    mapping = etl.build_merchant_category_map(rows)
    flags: list[str] = []

    assert etl.resolve_category("", "Zepto", mapping, flags) == "Groceries"
    assert etl.FLAG_CATEGORY_BACKFILLED in flags


def test_unknown_merchant_is_left_uncategorised_rather_than_guessed():
    flags: list[str] = []
    assert etl.resolve_category(None, "Mystery Shop", {}, flags) is None
    assert etl.FLAG_CATEGORY_UNRESOLVED in flags


@pytest.mark.parametrize(
    ("paise", "status", "quarantined", "expected"),
    [
        (45000, "SUCCESS", False, 4),        # ₹450 -> 4 coins
        (99, "SUCCESS", False, 0),           # under ₹100 -> nothing
        (5_000_000, "SUCCESS", False, 100),  # ₹50,000 -> capped at 100
        (45000, "FAILED", False, 0),         # failed payments earn nothing
        (45000, "PENDING", False, 0),
        (-45000, "SUCCESS", False, 0),       # refunds earn nothing
        (99999999900, "SUCCESS", True, 0),   # quarantined rows earn nothing
    ],
)
def test_coin_accrual_rules(paise, status, quarantined, expected):
    assert (
        etl.coins_for(paise, status, quarantined, divisor_rupees=100, cap=100) == expected
    )
