# Assumptions

The brief leaves things open on purpose. Here is every call I made, and the reasoning behind it. Where a decision affects money or coins, I went with the interpretation that cannot be gamed by the user.

---

## Coins

**One coin per ₹100, capped at 100 coins per transaction.**
The brief specifies the rate and says "capped per transaction" without giving a number. 100 coins means the cap bites at ₹10,000 — high enough that ordinary spending is never clipped, low enough that a single ₹7,42,350 payment does not mint 7,423 coins. Configurable in `backend/app/core/config.py`.

**Only successful payments earn.**
`FAILED` and `PENDING` transactions earn nothing. A payment that did not go through has not spent any money, and letting a failed payment mint coins would be farmable.

**Refunds earn nothing, and do not claw back.**
The 148 negative amounts are treated as refunds. They earn zero coins. They also do not remove previously earned coins — a real card would reverse the accrual, but the source data gives no link between a refund and the payment it reverses, so inventing one would be worse than not doing it. Flagged here because it is the assumption I am least sure about.

**Quarantined rows earn nothing.** The ₹99,99,99,999 row would otherwise mint the cap and distort the balance.

**A coin is worth ₹0.10.**
The brief does not price coins. Ten coins to the rupee puts the return at roughly 1% of spend, which is what a real Indian rewards card gives. It also makes the catalogue legible: a ₹250 voucher costs 2,500 coins.

**Coins are minted at seed time, not on read.**
Each earning transaction gets one `EARN` row in the ledger, enforced by a partial unique index. The balance is `SUM(delta)` over the ledger. A running counter would have been simpler and would have been wrong the first time a redeem half-failed.

---

## The rewards catalogue

**Six rewards, one deliberately out of reach.**
The brief asks for four to six. The seeded balance is 3,62,629 coins, so five are affordable immediately and the ₹50,000 statement cashback (5,00,000 coins) is not. That is intentional: the "locked" state with its progress bar is a real state a user hits, and it makes the backend's 409 reachable from the UI rather than only from a test.

**Stock is modelled but generous.** Two rewards have finite stock so the sold-out path exists in the schema and the API. Neither runs out during a demo.

**Redemption is instant and final.** No cooling-off, no cancellation, no expiry. Out of scope for a day.

---

## The data

**Reused transaction ids are two different payments, not duplicates.**
40 ids appear twice. In every case the two rows differ in merchant, amount and date — these are id collisions in whatever generated the file, not duplicated records. Dropping one of each pair would silently delete 40 real payments from the user's history. So `transactions.external_id` is indexed but **not** unique, and the primary key is a surrogate `BIGSERIAL`. If two rows had been byte-identical I would have deduplicated instead.

**`dd/mm/yyyy` is day-first.**
The file contains `31/12/2025`, which cannot be month-first. One unambiguous value fixes the format for all 841.

**Date-only timestamps are anchored to 00:00 IST.**
715 rows have a date and no time. Midnight IST keeps the row on the date the file claims. Midnight UTC would have shifted 715 payments to the previous day in every view.

**Months are bucketed in IST, not UTC.**
A payment at 01:30 IST on 1 April belongs to April, not to 31 March. The database index is built on the same expression the analytics query groups by.

**Amounts at or above ₹1 crore are corrupt, not real.**
Exactly one row qualifies (₹99,99,99,999). It is quarantined: still visible in the table with a struck-through amount, excluded from every chart and from coin accrual. Left in the analytics it would have been 96% of total spend and made every chart useless. Deleting it would have hidden a real property of the data — the middle path is to show it and exclude it, visibly.

**A blank category is inferred from the merchant, never guessed globally.**
200 rows have a null or empty category. Each merchant's dominant category is learned from the rows that do have one, and applied. All 200 resolved, because all 49 merchants are single-category in practice. A merchant with no learnable category would have been left `NULL` and shown as "Uncategorised" rather than assigned a plausible-looking lie.

**Amount filters compare magnitude.**
A "₹400 to ₹600" filter finds a ₹500 refund as well as a ₹500 payment. Filtering by sign is what the separate Payments / Refunds control is for.

---

## Product and scope

**One user, no authentication.**
The brief describes a consumer app but asks for a working slice, and hand-rolled auth in a day is a liability rather than a feature. There is a real `users` table and every query is scoped by `user_id`; `current_user_id()` in `app/api/deps.py` is the only thing that would change.

**All amounts are INR.** The dataset is entirely INR. The `currency` column exists and a non-INR row would be quarantined rather than silently summed into a rupee total.

**A drawer for detail, not a modal.** The brief allows either. A drawer keeps the table visible behind it, which matters when you are working down a filtered list.

**Server-side everything.** The brief calls this "the stronger approach". The browser never receives more than one page, so the table stays fast for reasons that would still hold at 10 million rows.

**The Data health screen is my own addition.** Not asked for. The brief does say it looks at "whatever you notice in the data", and the most useful way to show what I noticed is to let the app show it.

**Coins earned display on the transactions table.** Not required, but it makes the earning rule visible where the money is, rather than only on the rewards page.
