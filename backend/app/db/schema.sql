-- =====================================================================
-- Kosh — PostgreSQL schema
-- Target: PostgreSQL 18 (compatible with 16+)
--
-- Design notes (the "why" lives in DECISIONS.md, the short version here):
--   * Money is stored as BIGINT paise, never float. 3133.69 is 313369.
--   * The source file's `id` is NOT unique (40 collisions in 10k rows),
--     so transactions get a surrogate BIGSERIAL key and `external_id`
--     is a plain indexed column.
--   * Merchants and categories are real tables, not repeated strings:
--     the merchant -> category mapping is what lets the loader repair
--     the 200 rows that arrive with a missing category.
--   * Coins live in an append-only ledger. The balance is a SUM, never a
--     mutable counter, so a redeem can never "lose" coins on a partial
--     failure and every coin is traceable to the row that created it.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS data_quality_issues CASCADE;
DROP TABLE IF EXISTS ingestion_runs      CASCADE;
DROP TABLE IF EXISTS coin_ledger         CASCADE;
DROP TABLE IF EXISTS redemptions         CASCADE;
DROP TABLE IF EXISTS rewards             CASCADE;
DROP TABLE IF EXISTS transactions        CASCADE;
DROP TABLE IF EXISTS merchants           CASCADE;
DROP TABLE IF EXISTS categories          CASCADE;
DROP TABLE IF EXISTS users               CASCADE;

DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS payment_method     CASCADE;
DROP TYPE IF EXISTS transaction_flow   CASCADE;
DROP TYPE IF EXISTS ledger_entry_kind  CASCADE;
DROP TYPE IF EXISTS redemption_status  CASCADE;
DROP TYPE IF EXISTS reward_kind        CASCADE;
DROP TYPE IF EXISTS issue_severity     CASCADE;

-- ---------------------------------------------------------------- types
CREATE TYPE transaction_status AS ENUM ('SUCCESS', 'PENDING', 'FAILED');
CREATE TYPE payment_method     AS ENUM ('UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NETBANKING');
CREATE TYPE transaction_flow   AS ENUM ('DEBIT', 'REFUND');
CREATE TYPE ledger_entry_kind  AS ENUM ('EARN', 'REDEEM', 'REVERSAL', 'GRANT');
CREATE TYPE redemption_status  AS ENUM ('CONFIRMED', 'REVERSED');
CREATE TYPE reward_kind        AS ENUM ('VOUCHER', 'CASHBACK', 'DONATION', 'UPGRADE');
CREATE TYPE issue_severity     AS ENUM ('INFO', 'REPAIRED', 'QUARANTINED');

-- ---------------------------------------------------------------- users
CREATE TABLE users (
    id           BIGSERIAL PRIMARY KEY,
    email        TEXT        NOT NULL UNIQUE,
    display_name TEXT        NOT NULL,
    card_last4   CHAR(4)     NOT NULL DEFAULT '4291',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------- categories
CREATE TABLE categories (
    id      SMALLSERIAL PRIMARY KEY,
    slug    TEXT NOT NULL UNIQUE,
    name    TEXT NOT NULL UNIQUE,
    -- Chart colour is a data attribute, not a frontend hard-code, so a new
    -- category seeded tomorrow renders correctly without a deploy.
    hue     SMALLINT NOT NULL DEFAULT 210,
    sort_order SMALLINT NOT NULL DEFAULT 100
);

-- ------------------------------------------------------------ merchants
CREATE TABLE merchants (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    -- Learned from the dataset during ingestion and used to repair rows
    -- whose category is missing or blank.
    default_category_id SMALLINT REFERENCES categories (id)
);

-- --------------------------------------------------------- transactions
CREATE TABLE transactions (
    id             BIGSERIAL PRIMARY KEY,
    -- Not UNIQUE on purpose: the source data reuses ids across genuinely
    -- different payments. See ASSUMPTIONS.md.
    external_id    TEXT               NOT NULL,
    user_id        BIGINT             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    occurred_at    TIMESTAMPTZ        NOT NULL,
    merchant_id    INTEGER            NOT NULL REFERENCES merchants (id),
    category_id    SMALLINT           REFERENCES categories (id),
    amount_paise   BIGINT             NOT NULL,
    currency       CHAR(3)            NOT NULL DEFAULT 'INR',
    status         transaction_status NOT NULL,
    method         payment_method     NOT NULL,
    flow           transaction_flow   NOT NULL DEFAULT 'DEBIT',
    coins_earned   INTEGER            NOT NULL DEFAULT 0 CHECK (coins_earned >= 0),
    -- Which repairs the loader applied to this row, e.g. {AMOUNT_AS_STRING}.
    quality_flags  TEXT[]             NOT NULL DEFAULT '{}',
    -- Excluded from analytics and coin accrual, still visible in the table
    -- so nothing is silently dropped from the user's history.
    is_quarantined BOOLEAN            NOT NULL DEFAULT FALSE,
    -- Provenance only. The schema above is the source of truth; this is kept
    -- so the detail drawer can show the untouched source record.
    source_row     JSONB              NOT NULL,
    created_at     TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- Read patterns this app actually issues:
--   default list  -> ORDER BY occurred_at DESC LIMIT n
--   filtered list -> status / category / amount / date predicates + sort
--   analytics     -> GROUP BY category, GROUP BY month
CREATE INDEX idx_txn_user_occurred  ON transactions (user_id, occurred_at DESC);
CREATE INDEX idx_txn_user_amount    ON transactions (user_id, amount_paise DESC);
CREATE INDEX idx_txn_category       ON transactions (category_id) WHERE NOT is_quarantined;
CREATE INDEX idx_txn_status         ON transactions (status);
CREATE INDEX idx_txn_merchant       ON transactions (merchant_id);
CREATE INDEX idx_txn_external_id    ON transactions (external_id);
-- Months are bucketed in IST, not UTC: a 01:30 IST payment belongs to the
-- month the user thinks it happened in. Expression is IMMUTABLE, so it can
-- be indexed, and the analytics queries use the identical expression.
CREATE INDEX idx_txn_month          ON transactions
    (date_trunc('month', occurred_at AT TIME ZONE 'Asia/Kolkata'));

-- -------------------------------------------------------------- rewards
CREATE TABLE rewards (
    id           SERIAL PRIMARY KEY,
    slug         TEXT        NOT NULL UNIQUE,
    title        TEXT        NOT NULL,
    description  TEXT        NOT NULL,
    kind         reward_kind NOT NULL,
    coin_cost    INTEGER     NOT NULL CHECK (coin_cost > 0),
    value_paise  BIGINT      NOT NULL CHECK (value_paise >= 0),
    -- NULL = unlimited stock. 0 = sold out.
    stock        INTEGER     CHECK (stock IS NULL OR stock >= 0),
    icon         TEXT        NOT NULL DEFAULT 'parcel',
    accent       TEXT        NOT NULL DEFAULT 'amber',
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order   SMALLINT    NOT NULL DEFAULT 100
);

-- ---------------------------------------------------------- redemptions
CREATE TABLE redemptions (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         BIGINT            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reward_id       INTEGER           NOT NULL REFERENCES rewards (id),
    coin_cost       INTEGER           NOT NULL CHECK (coin_cost > 0),
    status          redemption_status NOT NULL DEFAULT 'CONFIRMED',
    -- Client-supplied key. A retried request returns the original result
    -- instead of charging the user twice.
    idempotency_key TEXT,
    voucher_code    TEXT              NOT NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_redemption_idempotency
    ON redemptions (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_redemption_user_created ON redemptions (user_id, created_at DESC);

-- ---------------------------------------------------------- coin ledger
-- Append-only. Balance = SUM(delta). Nothing in the app ever UPDATEs a row
-- here; a reversal is a new compensating entry.
CREATE TABLE coin_ledger (
    id             BIGSERIAL         PRIMARY KEY,
    user_id        BIGINT            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    delta          INTEGER           NOT NULL CHECK (delta <> 0),
    kind           ledger_entry_kind NOT NULL,
    transaction_id BIGINT            REFERENCES transactions (id) ON DELETE CASCADE,
    redemption_id  UUID              REFERENCES redemptions (id) ON DELETE SET NULL,
    note           TEXT,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT now(),
    -- EARN entries must be positive and REDEEM entries negative; the
    -- database refuses to store an incoherent ledger row.
    CONSTRAINT ledger_sign_matches_kind CHECK (
        (kind = 'EARN'     AND delta > 0) OR
        (kind = 'GRANT'    AND delta > 0) OR
        (kind = 'REVERSAL' AND delta > 0) OR
        (kind = 'REDEEM'   AND delta < 0)
    )
);

CREATE INDEX idx_ledger_user ON coin_ledger (user_id, created_at DESC);
-- One EARN entry per transaction, enforced by the database rather than by
-- "the seed script probably only ran once".
CREATE UNIQUE INDEX idx_ledger_one_earn_per_txn
    ON coin_ledger (transaction_id)
    WHERE kind = 'EARN';

-- --------------------------------------------------- ingestion / quality
CREATE TABLE ingestion_runs (
    id               SERIAL      PRIMARY KEY,
    source_file      TEXT        NOT NULL,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ,
    rows_in          INTEGER     NOT NULL DEFAULT 0,
    rows_loaded      INTEGER     NOT NULL DEFAULT 0,
    rows_repaired    INTEGER     NOT NULL DEFAULT 0,
    rows_quarantined INTEGER     NOT NULL DEFAULT 0,
    duration_ms      INTEGER
);

-- One row per class of problem found in the source file. This is what the
-- Data Health screen reads; the app never invents these numbers client-side.
CREATE TABLE data_quality_issues (
    id          SERIAL         PRIMARY KEY,
    run_id      INTEGER        NOT NULL REFERENCES ingestion_runs (id) ON DELETE CASCADE,
    code        TEXT           NOT NULL,
    label       TEXT           NOT NULL,
    detail      TEXT           NOT NULL,
    resolution  TEXT           NOT NULL,
    severity    issue_severity NOT NULL,
    row_count   INTEGER        NOT NULL,
    samples     JSONB          NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (run_id, code)
);

COMMIT;
