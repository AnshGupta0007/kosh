# AI usage

**Short version:** I used Claude (via Claude Code) heavily throughout — scaffolding, the CSS, the SQL, the docs. I read and edited everything it produced, and the parts that mattered most are the parts I had to correct.

---

## What I used, and where

| Tool | Where |
|---|---|
| **Claude (Claude Code)** | Most of it: schema, ETL rules, FastAPI layers, React components, CSS, tests, these docs |
| **Claude — data profiling** | First pass over `transactions.json`: distinct values, null counts, timestamp shapes, duplicate ids |
| **Headless Chrome, driven from Claude Code** | Screenshotting every screen at 1440px and 360px, light and dark, to review the UI |

**Where I did not use it:** the product decisions. The coin cap, the coin-to-rupee rate, quarantining rather than deleting the ₹99,99,99,999 row, pagination over virtualisation, making one reward deliberately unaffordable — those are in `ASSUMPTIONS.md` and `DECISIONS.md` because they are mine. AI is good at "here are three ways to do this"; it is not good at deciding which one this product wants.

---

## Four things I threw away or had to fix

### 1. `display: flex` on a `<td>` — broke the table's borders

The generated table CSS stacked the date and status cells with `display: flex` directly on the `<td>`. It looked plausible and typechecked fine.

It is wrong. A `display: flex` table cell leaves the table layout algorithm, so its bottom border no longer aligns with the rest of the row. On screen it rendered as a box drawn around the Status column across the whole table — subtle enough that I only caught it by screenshotting the dark theme and looking properly.

**Fix:** cells stay `display: table-cell`; the stacking moved to an inner `<span>`. This is the failure mode I care most about, because nothing catches it — not TypeScript, not the build, not a unit test. Only looking at it.

### 2. The PostgreSQL 18 Docker volume — container would not start

The first `docker-compose.yml` mounted the volume at `/var/lib/postgresql/data`, which is correct for Postgres 17 and every tutorial written before late 2025. The container exited immediately with code 1.

Postgres 18's image changed the layout: the mount belongs at `/var/lib/postgresql`, with the data in a version-named subdirectory so `pg_upgrade --link` can work across a mount boundary. The answer was in the container's own logs, not in the generated config.

**Worth noting because the brief specifically asks for PostgreSQL 18** — this is exactly the kind of thing that is wrong in training data for a release this recent, and it is a hard failure, not a subtle one.

### 3. `date_trunc('month', occurred_at)` — the index would not build

The generated schema included an index on `date_trunc('month', occurred_at)`. Postgres rejected it:

```
ERROR: functions in index expression must be marked IMMUTABLE
```

`date_trunc` on a `timestamptz` depends on the session's `TimeZone` setting, so it is `STABLE`, not `IMMUTABLE`, and cannot be indexed.

The fix is not just "add `AT TIME ZONE 'UTC'` to make it compile" — that would have been the easy wrong answer. For an Indian consumer app the months should be IST buckets anyway, so a payment at 01:30 IST on 1 April lands in April. The expression became `date_trunc('month', occurred_at AT TIME ZONE 'Asia/Kolkata')`, which is immutable *and* correct, and the analytics query uses the identical expression so it actually hits the index.

### 4. `"UPI"` rendered as `"Upi"`

A generic `humanizeMethod` helper lowercased the enum and title-cased each word: `CREDIT_CARD` → "Credit Card", correct; `UPI` → "Upi", wrong to anyone in India, which is everyone this app is for. Small, but it is the kind of thing that makes a product feel like it was built by someone who was not paying attention.

---

## The honest summary

AI made this roughly three times faster, mostly on the mechanical parts — CSS module boilerplate, pydantic schemas, test scaffolding, the shape of the FastAPI layers. It was genuinely good at the ETL rules once I had told it exactly what was wrong with the data.

Where it needed watching:

- **Anything version-specific.** Both hard failures above were current-release details (Postgres 18's volume layout, Next 15's Suspense requirement around `useSearchParams`).
- **Anything visual.** Code that compiles and looks right in the source can render wrong. The only fix is to look at it, which is why I screenshotted every screen at both widths and both themes rather than trusting the build passing.
- **Correct-looking SQL that Postgres rejects, or accepts and answers slowly.** The immutability error was loud. An index that silently is not used would not have been.

I can walk through and change any part of this live.
