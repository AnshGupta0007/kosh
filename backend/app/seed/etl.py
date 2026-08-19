"""
Normalisation layer for the supplied transactions.json.

The file is not clean. Every rule in here exists because of something
actually present in the 10,000 supplied rows, not because of defensive
guesswork:

  timestamp     five different encodings (ISO-Z, ISO+05:30, epoch millis,
                dd/mm/yyyy hh:mm:ss, bare yyyy-mm-dd)
  amount        20 rows arrive as strings, 148 are negative, one is
                999999999.0
  category      150 null + 50 empty string
  status        25 rows say "success" instead of "SUCCESS"
  id            40 ids are reused by two genuinely different payments

Every function here is pure and takes a plain dict, so the rules can be
unit-tested without a database.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

IST = timezone(timedelta(hours=5, minutes=30))

# --- flags ------------------------------------------------------------
# Recorded per row and surfaced in the UI, so a repaired row is always
# identifiable rather than silently rewritten.
FLAG_TIMESTAMP_EPOCH = "TIMESTAMP_EPOCH_MILLIS"
FLAG_TIMESTAMP_DMY = "TIMESTAMP_DAY_FIRST"
FLAG_TIMESTAMP_DATE_ONLY = "TIMESTAMP_DATE_ONLY"
FLAG_TIMESTAMP_OFFSET = "TIMESTAMP_LOCAL_OFFSET"
FLAG_AMOUNT_STRING = "AMOUNT_AS_STRING"
FLAG_AMOUNT_NEGATIVE = "AMOUNT_NEGATIVE_REFUND"
FLAG_AMOUNT_OUTLIER = "AMOUNT_IMPLAUSIBLE"
FLAG_CATEGORY_BACKFILLED = "CATEGORY_BACKFILLED"
FLAG_CATEGORY_UNRESOLVED = "CATEGORY_UNRESOLVED"
FLAG_STATUS_CASING = "STATUS_CASING_NORMALISED"
FLAG_DUPLICATE_ID = "DUPLICATE_SOURCE_ID"

_DMY_RE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$")
_DATE_ONLY_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_EPOCH_RE = re.compile(r"^\d{10,13}$")

_METHOD_MAP = {
    "upi": "UPI",
    "credit card": "CREDIT_CARD",
    "debit card": "DEBIT_CARD",
    "netbanking": "NETBANKING",
    "net banking": "NETBANKING",
}

_STATUS_MAP = {"success": "SUCCESS", "pending": "PENDING", "failed": "FAILED"}


class RowRejected(Exception):
    """Raised when a row cannot be repaired into something storable."""


@dataclass
class NormalisedRow:
    external_id: str
    occurred_at: datetime
    merchant: str
    category: str | None
    amount_paise: int
    currency: str
    status: str
    method: str
    flow: str
    coins_earned: int
    is_quarantined: bool
    flags: list[str] = field(default_factory=list)
    source_row: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------- time
def parse_timestamp(raw: Any, flags: list[str]) -> datetime:
    """Coerce any of the five observed encodings into an aware UTC datetime."""
    if raw is None or raw == "":
        raise RowRejected("timestamp is empty")

    if isinstance(raw, (int, float)):
        raw = str(int(raw))
    text = str(raw).strip()

    if _EPOCH_RE.match(text):
        flags.append(FLAG_TIMESTAMP_EPOCH)
        value = int(text)
        seconds = value / 1000 if len(text) > 10 else value
        return datetime.fromtimestamp(seconds, tz=timezone.utc)

    if match := _DMY_RE.match(text):
        # Day-first, not month-first: the file contains values like
        # "31/12/2025", which is only valid if the first field is the day.
        flags.append(FLAG_TIMESTAMP_DMY)
        day, month, year, hour, minute, second = (int(g) for g in match.groups())
        local = datetime(year, month, day, hour, minute, second, tzinfo=IST)
        return local.astimezone(timezone.utc)

    if match := _DATE_ONLY_RE.match(text):
        # No clock time in the source. Anchored to IST midnight, which keeps
        # the row inside the calendar day the file claims.
        flags.append(FLAG_TIMESTAMP_DATE_ONLY)
        year, month, day = (int(g) for g in match.groups())
        local = datetime.combine(date(year, month, day), time.min, tzinfo=IST)
        return local.astimezone(timezone.utc)

    normalised = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalised)
    except ValueError as exc:
        raise RowRejected(f"unparseable timestamp {text!r}") from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=IST)
        flags.append(FLAG_TIMESTAMP_DATE_ONLY)
    elif parsed.utcoffset() != timedelta(0):
        flags.append(FLAG_TIMESTAMP_OFFSET)
    return parsed.astimezone(timezone.utc)


# -------------------------------------------------------------- money
def parse_amount_paise(raw: Any, flags: list[str]) -> int:
    """Return the amount in integer paise. Floats never touch the database."""
    if raw is None or raw == "":
        raise RowRejected("amount is empty")

    if isinstance(raw, str):
        flags.append(FLAG_AMOUNT_STRING)
        cleaned = raw.replace(",", "").replace("₹", "").replace("INR", "").strip()
    else:
        cleaned = str(raw)

    try:
        rupees = Decimal(cleaned)
    except (InvalidOperation, ValueError) as exc:
        raise RowRejected(f"unparseable amount {raw!r}") from exc

    paise = int((rupees * 100).to_integral_value(rounding="ROUND_HALF_UP"))
    if paise == 0:
        raise RowRejected("amount is zero")
    if paise < 0:
        flags.append(FLAG_AMOUNT_NEGATIVE)
    return paise


# ------------------------------------------------------------- fields
def normalise_status(raw: Any, flags: list[str]) -> str:
    text = str(raw or "").strip()
    mapped = _STATUS_MAP.get(text.lower())
    if mapped is None:
        raise RowRejected(f"unknown status {raw!r}")
    if text != mapped:
        flags.append(FLAG_STATUS_CASING)
    return mapped


def normalise_method(raw: Any) -> str:
    mapped = _METHOD_MAP.get(str(raw or "").strip().lower())
    if mapped is None:
        raise RowRejected(f"unknown payment method {raw!r}")
    return mapped


def resolve_category(raw: Any, merchant: str, merchant_map: dict[str, str], flags: list[str]):
    """Blank categories are inferred from the merchant's dominant category."""
    text = (raw or "").strip() if isinstance(raw, str) else None
    if text:
        return text

    inferred = merchant_map.get(merchant)
    if inferred:
        flags.append(FLAG_CATEGORY_BACKFILLED)
        return inferred

    flags.append(FLAG_CATEGORY_UNRESOLVED)
    return None


def build_merchant_category_map(rows: list[dict[str, Any]]) -> dict[str, str]:
    """Learn merchant -> most common category from the rows that do have one."""
    tally: dict[str, dict[str, int]] = {}
    for row in rows:
        merchant = (row.get("merchant") or "").strip()
        category = (row.get("category") or "").strip() if isinstance(row.get("category"), str) else ""
        if not merchant or not category:
            continue
        tally.setdefault(merchant, {})
        tally[merchant][category] = tally[merchant].get(category, 0) + 1
    return {
        merchant: max(counts.items(), key=lambda kv: kv[1])[0] for merchant, counts in tally.items()
    }


# -------------------------------------------------------------- coins
def coins_for(
    amount_paise: int,
    status: str,
    is_quarantined: bool,
    *,
    divisor_rupees: int,
    cap: int,
) -> int:
    """1 coin per ₹100 of successful spend, capped per transaction.

    Refunds (negative amounts), non-successful payments and quarantined rows
    earn nothing — you should not be able to farm coins with a failed payment.
    """
    if status != "SUCCESS" or amount_paise <= 0 or is_quarantined:
        return 0
    coins = amount_paise // (divisor_rupees * 100)
    return min(int(coins), cap)


# ------------------------------------------------------------ the row
def normalise_row(
    row: dict[str, Any],
    merchant_map: dict[str, str],
    *,
    quarantine_amount_paise: int,
    divisor_rupees: int,
    cap: int,
    duplicate_ids: set[str],
) -> NormalisedRow:
    flags: list[str] = []

    external_id = str(row.get("id") or "").strip()
    if not external_id:
        raise RowRejected("missing id")

    merchant = str(row.get("merchant") or "").strip()
    if not merchant:
        raise RowRejected("missing merchant")

    occurred_at = parse_timestamp(row.get("timestamp"), flags)
    amount_paise = parse_amount_paise(row.get("amount"), flags)
    status = normalise_status(row.get("status"), flags)
    method = normalise_method(row.get("payment_method"))
    category = resolve_category(row.get("category"), merchant, merchant_map, flags)

    currency = str(row.get("currency") or "INR").strip().upper()

    is_quarantined = abs(amount_paise) >= quarantine_amount_paise or currency != "INR"
    if is_quarantined:
        flags.append(FLAG_AMOUNT_OUTLIER)

    if external_id in duplicate_ids:
        flags.append(FLAG_DUPLICATE_ID)

    flow = "REFUND" if amount_paise < 0 else "DEBIT"

    return NormalisedRow(
        external_id=external_id,
        occurred_at=occurred_at,
        merchant=merchant,
        category=category,
        amount_paise=amount_paise,
        currency=currency,
        status=status,
        method=method,
        flow=flow,
        coins_earned=coins_for(
            amount_paise, status, is_quarantined, divisor_rupees=divisor_rupees, cap=cap
        ),
        is_quarantined=is_quarantined,
        flags=flags,
        source_row=row,
    )
