# Kosh

**A credit-card payments, spend analytics and coin rewards dashboard, built over the 10,000-row dataset supplied with the Digital Alpha take-home.**

Next.js 15 · TypeScript · FastAPI · PostgreSQL 18

---

## Live

| | |
|---|---|
| **Web** | **https://kosh-umber.vercel.app** |
| **API** | **https://kosh-api-ps80.onrender.com** |
| **API docs** | https://kosh-api-ps80.onrender.com/docs |
| **Health** | https://kosh-api-ps80.onrender.com/api/health |

Vercel · Render · Neon Postgres.

> **The API sleeps.** Render's free tier spins a service down after ~15 minutes
> idle, so the **first request can take 30–60 seconds** while it wakes. The
> frontend retries, so the page fills in on its own — it is not broken, just
> cold. Loading the health link above first is the quickest way to wake it.

> **Hosted Postgres is 17, local is 18.** Neon's current default is PostgreSQL 17,
> which the brief allows ("16 or newer is fine if your host doesn't offer 18
> yet"). `docker compose` runs 18.6 locally, and the schema is identical on both.

---

## What it does

**Overview** — a spend calendar covering every one of the 380 days in the dataset, plus five KPIs, a category donut, a monthly trend, a top-merchant ranking and a payment-method split, sitting above the full 10,000-row transactions table.

The calendar is the one view where the whole dataset is on screen at once. It is a sequential encoding done properly — a single hue stepped by lightness, anchor flipped for dark mode, levels set by quintiles of active days rather than a linear slice of the max, so one ₹9.2L outlier does not flatten the other 379 days into the bottom bucket. It behaves as a brush: it always shows the full date domain even while a day is selected, so clicking a square narrows the rest of the page without collapsing the control you clicked in. Keyboard users get one tab stop and arrow-key navigation rather than 380 tab stops. Filter by category, status, method, date range, amount range and type; search merchants as you type; sort by date, amount, merchant or coins. Click any row for full detail including the untouched source record.

**Cross-filtering works in both directions.** Clicking a donut slice, a month bar or a merchant filters the table. Filtering the table reshapes every chart. Neither component knows the other exists — they both read the same filter state out of the URL.

**Rewards** — a coin balance that is visible in the header on every screen, a six-item catalogue, and a select → confirm → done redeem flow. The balance updates optimistically and rolls back cleanly if the call fails. The backend rejects an unaffordable or unknown redeem with a proper status code, and a retried request replays instead of charging twice.

**Data health** — the part I would show first. The supplied `transactions.json` is deliberately dirty. This screen is the loader's own report of what it found and what it did about it, read straight out of the database.

---

## What I found in the data

`transactions.json` needed repair on **4,772 of its 10,000 rows**. None of this is hypothetical — every item is a count from the loaded database:

| What | Rows | What the loader did |
|---|---:|---|
| Timestamps with a `+05:30` offset | 1,961 | Converted to UTC, offset preserved in the source record |
| Timestamps as epoch milliseconds | 1,007 | Parsed as millis, not seconds |
| Timestamps as `dd/mm/yyyy` | 841 | Day-first — proven by values like `31/12/2025` |
| Timestamps with no clock time | 715 | Anchored to 00:00 IST so the row keeps its stated date |
| Blank or null category | 200 | Backfilled from the merchant's dominant category |
| Negative amounts | 148 | Treated as refunds: kept, marked as inflow, earn no coins |
| Reused transaction ids | 80 | Both kept — the source id is genuinely not unique |
| `"success"` instead of `"SUCCESS"` | 25 | Normalised to the enum value |
| Amounts as strings (`"5065.00"`) | 20 | Parsed with `Decimal`, stored as integer paise |
| One payment of ₹99,99,99,999 | 1 | Quarantined: still listed, excluded from analytics and coins |

Nothing was dropped. Every repair is recorded per row and shown in the detail drawer, so a repaired row is always identifiable rather than silently rewritten.

---

## Running it locally

**Needs:** Docker, Python 3.11+, Node 20+. Nothing else.

```bash
git clone <this-repo> && cd kosh
make setup     # Postgres 18 + deps + schema + all 10,000 rows
make dev       # API on :8000, web on :3000
```

`make setup` takes about two minutes, most of it `npm install`. The seed itself loads all 10,000 rows in **~600 ms**.

<details>
<summary>Without <code>make</code></summary>

```bash
# 1. PostgreSQL 18
docker compose up -d

# 2. Config
cp .env.example .env && cp .env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# 3. Backend + schema + data (one command, idempotent)
python3 -m venv backend/.venv
backend/.venv/bin/pip install -e "./backend[dev]"
cd backend && ../backend/.venv/bin/python -m app.seed.run && cd ..

# 4. Frontend
cd frontend && npm install && cd ..

# 5. Run
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000   # terminal 1
cd frontend && npm run dev                                          # terminal 2
```
</details>

**The seed command is `.venv/bin/python -m app.seed.run`, run from `backend/`.**
(`make seed` does the same thing from the repo root. Use the venv's Python explicitly — a bare `python` picks up the system interpreter, which does not have the dependencies.)

To seed a **hosted** database instead of the local one, point `DATABASE_URL` at it for that one command:

```bash
cd backend
DATABASE_URL="postgresql://…your hosted connection string…" .venv/bin/python -m app.seed.run
``` It drops and recreates the schema, normalises the dataset, loads it, mints the coin ledger and writes the data-quality report. Re-running it is safe.

```bash
make test    # 36 backend tests against a real throwaway Postgres database
make lint    # ruff + tsc + next lint
make reset   # destroy the volume and rebuild from nothing
```

---

## Stack and structure

```
backend/                    FastAPI — routes decide nothing, services decide everything
  app/api/routes/           HTTP: parse, delegate, serialise
  app/api/filters.py        the filter contract shared by the table and the charts
  app/services/             business logic (redeem, analytics, listing)
  app/repositories/         all SQL, and the only place it lives
  app/db/schema.sql         the schema, hand-written and commented
  app/seed/etl.py           normalisation rules — pure functions, unit-tested
  app/seed/run.py           the one-command seed
  tests/                    36 tests, real Postgres, no mocks

frontend/
  src/components/ui/        the internal design system (Button, Card, Table…)
  src/features/             transactions · analytics · rewards · quality
  src/lib/filters.ts        URL ⇄ filter state
  src/styles/tokens.css     every colour, space, type step and shadow
```

**Frontend:** Next.js 15 App Router, React 19, TypeScript in strict mode, CSS Modules over design tokens (no Tailwind, no UI library), TanStack Query for server state, Recharts for the two charts.

**Backend:** FastAPI, SQLAlchemy Core, psycopg 3. Layered so a route never touches SQL and a repository never returns an HTTP status.

**Database:** PostgreSQL 18 — a real schema with enum types, check constraints, partial unique indexes and money as `BIGINT` paise.

---

## API

| | |
|---|---|
| `GET /api/transactions` | Paginated, filtered, sorted — **in Postgres**, not the browser |
| `GET /api/transactions/{id}` | Full detail plus the untouched source record |
| `GET /api/transactions/options` | Filter values, derived from the data |
| `GET /api/analytics` | KPIs, category, monthly, method and merchant breakdowns |
| `GET /api/wallet/balance` | Balance, summed from the ledger on every read |
| `GET /api/rewards` | Catalogue with server-computed affordability |
| `POST /api/rewards/redeem` | 201 · 404 unknown reward · 409 unaffordable · 422 malformed |
| `GET /api/rewards/redemptions` | Redemption history |
| `GET /api/data-quality` | The ingestion report |
| `GET /api/health` | Liveness and row count |

All ten endpoints take the same filter parameters where it makes sense, which is what keeps the charts and the table honest.

---

## Done / not done

### Done

- [x] Transactions table on all 10,000 rows — hand-built, no component library
- [x] Filter by category, date range, amount range, status, method and type, all combinable
- [x] Search merchants as you type (debounced)
- [x] Sort by date, amount, merchant and coins
- [x] Row detail in a drawer, including the raw source record
- [x] **Server-side** pagination, filtering and sorting
- [x] Spend by category **and** monthly trend, plus a daily spend calendar, merchant and method breakdowns
- [x] **Two-way** cross-filtering between charts and table
- [x] Coin balance visible on every screen
- [x] Six rewards, select → confirm → done, with optimistic update and rollback
- [x] Backend rejects unaffordable (409) and unknown (404) redeems
- [x] Idempotency keys, so a retry cannot double-charge
- [x] PostgreSQL 18, real schema, one-command seed
- [x] Hand-built modal and drawer: focus trap, Escape, focus restore
- [x] Light and dark themes, no flash on load
- [x] Responsive to 360px — the table becomes cards from the same markup, and the filter bar collapses behind a toggle so data is visible on a phone rather than seven controls
- [x] A spend calendar over all 380 days — the one view where the whole dataset is on screen
- [x] Hand-drawn SVG icon set (no emoji anywhere)
- [x] Chart colours validated against a colour formula, not chosen by eye
- [x] Deployed: Vercel + Render + Neon, verified end to end in production
- [x] 36 backend tests, including six on the redeem endpoint
- [x] Accessibility: semantic table, `aria-sort`, keyboard-operable rows and charts, skip link, live-region toasts, reduced-motion support
- [x] ⌘K command palette
- [x] Data health screen

### Not done

- **No authentication.** Single seeded demo user. Every query is still scoped by `user_id`, so adding auth means changing one dependency function.
- **No frontend tests.** The backend is covered; the UI was verified by hand across widths and themes. If I had another hour it would go on the filter reducer and the optimistic-rollback path.
- **Virtualisation.** Server-side pagination made it unnecessary; see `DECISIONS.md`.
- **Redemptions do not expire, and vouchers are not real.** The code is generated, not issued.

### Known issues

- Recharts renders the donut and the bars into SVG that does not resize until the next animation frame, so a fast window resize can leave a chart briefly mis-sized. It corrects itself.
- `useFilterOptions` caches with `staleTime: Infinity`. Re-seeding while the app is open needs a refresh to pick up new categories.
- **Cold starts.** Render's free tier sleeps after ~15 minutes idle; the first request takes 30–60 seconds. Everything after that is fast.
- **Cross-region latency.** The API runs in Render's US region and Neon sits in Singapore, so a query that takes 8–40 ms locally takes ~350 ms in production. It is the network, not the query: the same SQL against local Postgres 18 is unchanged. Co-locating both in one region would fix it, and I would do that with a paid tier.
- No walkthrough video — the app is deployed, and the brief makes the video optional in that case.

---

## Also in this repo

- **[ASSUMPTIONS.md](ASSUMPTIONS.md)** — every product call I made where the brief was open, and why
- **[DECISIONS.md](DECISIONS.md)** — the technical choices that mattered, including the ones I would revisit
- **[AI-USAGE.md](AI-USAGE.md)** — what I used AI for, and four things it got wrong that I had to fix
