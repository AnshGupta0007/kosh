/**
 * Formatting helpers.
 *
 * Amounts arrive as integer paise and are divided exactly once, here.
 * Everything is Indian-locale aware: lakh/crore grouping (₹70,69,801) rather
 * than the thousands grouping a default `Intl` setup would give.
 */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat("en-IN");

/** ₹1,25,430.50 — full precision, for detail views and table cells. */
export function formatRupees(paise: number): string {
  return INR.format(paise / 100);
}

/** ₹1,25,431 — no paise, for figures where the decimals are noise. */
export function formatRupeesWhole(paise: number): string {
  return INR_WHOLE.format(paise / 100);
}

/**
 * ₹70.7L / ₹1.24Cr — Indian short scale, for axis labels and stat tiles
 * where the exact figure would not fit and is not the point.
 */
export function formatRupeesCompact(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? "-" : "";

  if (rupees >= 1_00_00_000) return `${sign}₹${(rupees / 1_00_00_000).toFixed(2)}Cr`;
  if (rupees >= 1_00_000) return `${sign}₹${(rupees / 1_00_000).toFixed(1)}L`;
  if (rupees >= 1_000) return `${sign}₹${(rupees / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(rupees)}`;
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

export function formatCoins(coins: number): string {
  return NUMBER.format(coins);
}

/** What a coin pile is worth in rupees, for "≈ ₹3,626" secondary copy. */
export function coinsToRupees(coins: number, coinValuePaise: number): string {
  return formatRupeesWhole(coins * coinValuePaise);
}

const DATE_SHORT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  timeZone: "Asia/Kolkata",
});

const TIME_SHORT = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

const DATE_FULL = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/**
 * All dates render in IST regardless of where the browser is.
 * The backend stores UTC; the user thinks in Indian Standard Time, and a
 * payment made at 01:30 IST should not appear on the previous day.
 */
export function formatDate(iso: string): string {
  return DATE_SHORT.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return TIME_SHORT.format(new Date(iso));
}

export function formatDateTimeFull(iso: string): string {
  return DATE_FULL.format(new Date(iso));
}

/** "yyyy-mm-dd" in IST, for date inputs and URL params. */
export function toISTDateInput(iso: string): string {
  const date = new Date(iso);
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** "Credit Card" from "CREDIT_CARD" — enum values are never shown raw. */
export function humanizeMethod(method: string): string {
  // UPI is an initialism, not a word; title-casing it to "Upi" looks wrong
  // to anyone in India, which is everyone this app is for.
  if (method === "UPI") return "UPI";
  return method
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** "1 row" / "12 rows" — never "1 rows". */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function humanizeStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Turns a quality flag constant into the sentence shown in the drawer. */
export const QUALITY_FLAG_COPY: Record<string, string> = {
  TIMESTAMP_EPOCH_MILLIS: "Timestamp arrived as Unix milliseconds",
  TIMESTAMP_DAY_FIRST: "Timestamp arrived as dd/mm/yyyy",
  TIMESTAMP_DATE_ONLY: "Timestamp had no clock time; anchored to IST midnight",
  TIMESTAMP_LOCAL_OFFSET: "Timestamp carried a +05:30 offset; stored as UTC",
  AMOUNT_AS_STRING: "Amount arrived as a string",
  AMOUNT_NEGATIVE_REFUND: "Negative amount; treated as a refund",
  AMOUNT_IMPLAUSIBLE: "Implausible amount; excluded from analytics and coins",
  CATEGORY_BACKFILLED: "Category was blank; inferred from this merchant",
  CATEGORY_UNRESOLVED: "Category was blank and could not be inferred",
  STATUS_CASING_NORMALISED: "Status casing normalised",
  DUPLICATE_SOURCE_ID: "This id is reused by another, different payment",
};

export function describeFlag(flag: string): string {
  return QUALITY_FLAG_COPY[flag] ?? flag;
}
