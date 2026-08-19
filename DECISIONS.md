# Decisions

The technical choices that mattered, what they cost, and the ones I would revisit.

---

## 1. Filter state lives in the URL, not in a store

`?cat=Travel&st=SUCCESS&sort=amount&page=3` **is** the application state. There is no Redux, no Zustand, no filter context.

**Why.** Three problems disappear at once:

- The back button steps through filter changes, because they are history entries.
- Any view is shareable and reloadable as a link.
- **The charts and the table cannot disagree.** This is the real reason. Two-way cross-filtering usually means two components synchronising state, which is where the bugs live. Here the donut writes a category into the URL, the table reads it, and the analytics endpoint reads it too. Neither component imports the other. There is exactly one copy of the state, so there is nothing to keep in sync.

**Cost.** Every filter change is a router navigation, so the search box needs local state plus a debounce or it would push a history entry per keystroke (`router.replace`, 250 ms). Filter values also have to survive a string round-trip, which rules out storing anything richer than strings.

**Alternative considered.** A context + reducer. Less URL plumbing, but then "clicking a slice filters the table" and "filtering the table reshapes the slice" become two separate code paths that have to agree — and shareable links are gone.

---

## 2. Server-side pagination, not virtualisation

The brief asks which and why. **Pagination, done in PostgreSQL.**

**Why.** Virtualisation solves rendering 10,000 rows. It does not solve *fetching* them — the browser still downloads the full dataset (about 1.6 MB of JSON), parses it, holds it in memory, and then does the filtering and sorting itself on the main thread. That works at 10,000 rows and falls over at 100,000, and the point where it falls over arrives without warning.

Doing it in Postgres means the browser holds 50 rows regardless of how many match. Filtering, sorting and counting run against indexes, and a filtered query on the full dataset returns in **8–40 ms**. The approach does not change shape as the table grows.

It is also the honest answer for a financial app: the client that only ever receives the page it is showing is the client that cannot leak the rest.

**Cost.** Every sort and page is a round trip. Mitigated with TanStack Query's `keepPreviousData`, so the previous page stays on screen under a progress bar rather than flashing empty.

**What I would add with more time.** Keyset pagination instead of `OFFSET`. `OFFSET 9950` makes Postgres walk 9,950 rows it then throws away — invisible at this size, not at ten million.

---

## 3. Money is `BIGINT` paise, never a float

`3133.69` is stored as `313369`.

The dataset itself makes the argument: `912.62` is not representable in binary floating point, and `int(912.62 * 100)` evaluates to `91261` — a paisa lost, silently, on import. The loader parses with `Decimal` and stores an integer. There is exactly one division by 100 in the entire codebase, in the frontend formatter, at the moment a number becomes text.

---

## 4. The coin balance is a `SUM` over an append-only ledger

There is no `users.coin_balance` column. `coin_ledger` is append-only, every row carries the transaction or redemption that caused it, and the balance is `SUM(delta)`.

**Why.** A mutable counter has to be updated in the same transaction as the redemption, and if anything about that goes wrong the balance is wrong with no way to tell. A ledger cannot drift: it is the audit trail *and* the source of truth. Every one of the 3,62,629 coins traces back to the payment that earned it. A reversal is a new compensating row, not an edit.

The database enforces coherence: a `CHECK` constraint makes `EARN` rows positive and `REDEEM` rows negative, and a partial unique index allows exactly one `EARN` per transaction — so re-running the seed cannot double-mint.

**Cost.** Reading the balance is an aggregate rather than a column read. At ~8,600 ledger rows this is sub-millisecond. At ten million it wants a materialised balance with the ledger as the reconciliation source — but that is an optimisation applied later, not a design to start with.

---

## 5. Redeem: lock, then check, then write — and accept an idempotency key

```
SELECT id FROM users WHERE id = :user FOR UPDATE   -- serialise this user
→ read balance
→ reject (404 / 409) or insert redemption + ledger row
→ commit
```

Reading the balance before locking is the classic bug: two concurrent requests both see 3,000 coins, both pass the check, and both spend them. The row lock makes redeems for one user strictly sequential. Postgres does the hard part.

**Idempotency.** The client generates one key per confirmation dialog and reuses it on every retry. If the first request reached the server and only the response was lost, the retry returns the *original* redemption instead of buying a second one. Enforced by a partial unique index on `(user_id, idempotency_key)`. Without it, "the redeem timed out, let me press it again" costs the user real money.

**Status codes.** 404 for a reward that does not exist. **409, not 400, for insufficient coins** — the request is well formed, it conflicts with current state, and it will succeed unchanged once the balance grows. 422 for a malformed body, from FastAPI's own validation.

---

## 6. Optimistic balance update with a real rollback

The header balance drops the moment the user confirms, before the server has answered.

`onMutate` snapshots the cached balance and the catalogue, then writes the optimistic values. `onError` puts the snapshot back. `onSuccess` replaces it with the server's authoritative balance, so the optimistic figure can never drift from the truth. `onSettled` invalidates regardless.

The catalogue is rolled back alongside the balance, not just the balance — affordability is derived from it, and a card claiming "Redeem" for something the API will reject is exactly the bug optimism introduces if you are careless.

---

## 7. CSS Modules over design tokens — no Tailwind, no UI library

The brief requires the table to be hand-built and says it is where the CSS is judged. I extended that to the whole app: no MUI, no shadcn, no Tailwind.

**Structure.** `tokens.css` declares primitives (raw values), then semantics (`--surface-2`, `--text-tertiary`, `--accent`), and light mode re-points only the semantic layer. No component contains a hex value, which is why the theme switch is a single attribute on `<html>` and not a second stylesheet.

**Why not Tailwind.** With utilities, this document would be the only place the reasoning exists. In `TransactionTable.module.css` the reasoning sits next to the rule it explains — why the sticky header lives inside a bounded scroll region, why focus is an inset box-shadow rather than an outline. That is the part worth reading.

**The table specifically.** A real `<table>` with `<th scope="col">` and `aria-sort`, because those semantics are what make it work with a screen reader and with browser find-in-page. Below 760px the *same* markup re-lays itself out as cards using grid areas on the `<tr>` — one component and one set of semantics at every width, rather than a separate mobile list that drifts out of sync with the desktop one.

**One bug worth recording:** I initially set `display: flex` on two `<td>`s to stack their contents. That takes the cell out of the table layout algorithm, and its bottom border stops lining up with the row — visible as a box drawn around the Status column. Cells stay `table-cell`; stacking happens on an inner element.

---

## 7a. Charts follow a colour formula, not taste

Every chart colour in the app was run through a validator (lightness band, chroma floor, colourblind separation, contrast against the surface) rather than picked by eye. Two things changed as a result:

- The first status trio put amber and red at ΔE 11.9 for **normal** vision — two colours a fully-sighted reader cannot reliably tell apart. Re-stepped to pass.
- The dark-mode chart green is chosen against the dark surface, not flipped from the light one. A palette that is correct on white is usually too light on black.

**The ten-category donut became ranked bars.** Three reasons, in order of weight: a categorical palette tops out around eight distinguishable hues, so ten wedges cannot be coloured honestly; these categories are *nominal* and what is compared is magnitude, so colouring each one spends the identity channel re-encoding what bar length already says; and people read length far more accurately than angle. One hue for every bar is both the correct answer and the calmer one.

The spend calendar is a **sequential** encoding and follows that rule instead: a single hue stepped by lightness, anchor flipped for dark mode, with levels drawn from quintiles of the active days so one ₹9.2L outlier does not flatten the other 379 into the bottom bucket.

---

## 7b. The visual language, and why the card exists

The first version of this UI was competent and completely forgettable — near-black surfaces, grey cards, an accent colour that barely appeared. It looked like every dashboard template, which for a frontend-focused role is the wrong thing to hand in.

Four changes fixed it, and each one is a rule rather than a decoration:

**The card is the product's subject.** This app is about paying a credit-card bill, and the first build had no card in it — just charts about an abstraction. `PaymentCard` is drawn entirely in CSS at ISO/IEC 7810 ID-1 proportions (1.586:1), so it stays sharp at any size and costs nothing to load. It is also the right home for the coin balance: on the card, where a real rewards programme puts it. Notably it keeps its dark treatment in light mode — a physical object does not invert because the page did.

**Gold means coins, and nothing else.** The accent appears on the balance, the coin figures, the primary action and the peak month. Everywhere else is neutral. An accent used for everything is an accent used for nothing.

**Neutrals are tinted, not grey.** The greys carry a violet-navy cast. Against a true neutral grey, gold reads as mustard; against a slightly cool ground it reads as metal. Two fixed pools of coloured light behind the page (`body::before`, one element, no JavaScript) stop the background reading as flat black.

**Surfaces are lit, not filled.** Every card carries `--edge-highlight`: a 1px inset highlight on its top edge. It is the difference between a surface catching the light and a rectangle of colour, and it costs one token.

**Typography went through one full reversal.** The first version set every figure in a display serif. It read as a newspaper rather than a money product — no modern payments app sets numbers in a serif, and next to it the whole interface looked dated. Plus Jakarta Sans now carries both jobs: the interface at 400–600, and figures at 700–800 with tight tracking, which is what makes a number read as *a number you should care about* rather than as decorative text. One figure on the Overview page is deliberately far larger than anything else, because if a reader takes one number away it should be that one.

---

## 8. Sticky header inside a bounded scroll region

The table's scroll container has a `max-height` and `overflow: auto`, and `<thead>` sticks to its top — rather than the header sticking to the page under the app bar.

A horizontally scrollable ancestor computes `overflow-y` to `auto`, which makes a page-level sticky header stick to a container that does not scroll vertically. It silently does nothing. Bounding the region makes the behaviour explicit and correct in both axes.

---

## 9. Layered backend

`routes → services → repositories`. A route parses and serialises. A service decides. A repository holds SQL and nothing else. Domain errors (`InsufficientCoins`, `RewardNotFound`) carry their own status code and are converted to the API's error shape by one exception handler, so no route builds an error body by hand and every error response has the same shape.

**SQLAlchemy Core with `text()`, not the ORM.** The interesting queries here are aggregates — `FILTER (WHERE …)`, `date_trunc` in a named timezone, grouped shares. Expressing those through an ORM obscures them without making them safer; every value is still bound, and the only strings that reach the SQL are column names from a fixed allow-list.

**The filter contract is shared.** `TransactionFilters.where()` builds the predicate once and both the list endpoint and all five analytics aggregates use it. That is what makes cross-filtering trustworthy: the donut and the table are provably answering the same question, and there is a test asserting their totals match.

---

## 10. Tests run against real PostgreSQL

36 tests, no mocks, against a throwaway `kosh_test` database created on the fly.

The schema is as much under test as the Python. Enum types, the check constraint on ledger sign, the partial unique index on idempotency keys — none of them exist in SQLite, so a test suite that mocked the database would pass while the deployed app failed. The redeem endpoint gets six tests, and the important assertion in the rejection cases is not the status code, it is that **the balance is unchanged afterwards**.

---

## Things I would change

- **`OFFSET` pagination.** Fine here, wrong at scale. Keyset would be the fix.
- **No frontend tests.** The filter reducer and the optimistic-rollback path are both pure and both deserve one.
- **Analytics fires five queries per request.** They could be one round trip with CTEs. Five indexed aggregates over 10,000 rows total ~40 ms, so it has not earned the complexity yet.
- **Refunds do not reverse coin accrual.** Correct behaviour needs a link between a refund and its original payment, which the data does not provide. See `ASSUMPTIONS.md`.
- **`staleTime: Infinity` on filter options.** Right for a demo, wrong the moment categories can change at runtime.
