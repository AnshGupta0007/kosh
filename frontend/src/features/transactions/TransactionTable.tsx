"use client";

import { Badge, CoinAmount, Skeleton } from "@/components/ui";
import {
  formatDate,
  formatRupees,
  formatTime,
  humanizeMethod,
  humanizeStatus,
} from "@/lib/format";
import type { SortField, SortOrder, Transaction, TransactionStatus } from "@/lib/types";

import styles from "./TransactionTable.module.css";

const STATUS_TONE: Record<TransactionStatus, "success" | "warning" | "danger"> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
};

interface Column {
  key: string;
  header: string;
  sortField?: SortField;
  align?: "start" | "end";
  /** Which breakpoint class hides this column, if any. */
  hideClass?: string;
}

const COLUMNS: Column[] = [
  { key: "date", header: "Date", sortField: "occurred_at" },
  { key: "merchant", header: "Merchant", sortField: "merchant" },
  { key: "category", header: "Category", hideClass: "hideMd" },
  { key: "method", header: "Method", hideClass: "hideLg" },
  { key: "status", header: "Status" },
  { key: "coins", header: "Coins", sortField: "coins", align: "end", hideClass: "hideMd" },
  { key: "amount", header: "Amount", sortField: "amount", align: "end" },
];

interface TransactionTableProps {
  rows: Transaction[];
  loading: boolean;
  refreshing: boolean;
  sort: SortField;
  order: SortOrder;
  density: "comfortable" | "compact";
  selectedId: number | null;
  pageSize: number;
  onSort: (field: SortField) => void;
  onSelect: (transaction: Transaction) => void;
}

/**
 * The transactions table — built from scratch, no table library.
 *
 * A real <table> with real <th scope="col"> and aria-sort, because the
 * semantics are what make it usable with a screen reader and what make
 * browser find-in-page work. The header is sticky inside a bounded scroll
 * area rather than page-sticky: a horizontally scrollable region computes
 * overflow-y to auto, which would silently break a page-level sticky header.
 *
 * Below 760px the same markup re-lays itself out as a card per row using
 * grid areas, so there is one component and one set of semantics at every
 * width — not a separate mobile list that can drift out of sync.
 */
export function TransactionTable({
  rows,
  loading,
  refreshing,
  sort,
  order,
  density,
  selectedId,
  pageSize,
  onSort,
  onSelect,
}: TransactionTableProps) {
  const skeletonRows = Math.min(pageSize, 12);

  return (
    <div className={styles.wrapper}>
      {/* A thin progress bar, not a spinner over the data: the previous page
          stays readable while the next one is fetched. */}
      {refreshing && !loading ? <div className={styles.progress} aria-hidden /> : null}

      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Transactions table">
        <table
          className={`${styles.table} ${styles[density]} ${refreshing ? styles.stale : ""}`}
        >
          <caption className="sr-only">
            Transactions, sorted by {sort} {order === "desc" ? "descending" : "ascending"}.
            Activate a row to open its full detail.
          </caption>

          <thead className={styles.thead}>
            <tr>
              {COLUMNS.map((column) => {
                const isSorted = column.sortField === sort;
                const ariaSort = !column.sortField
                  ? undefined
                  : isSorted
                    ? order === "asc"
                      ? "ascending"
                      : "descending"
                    : "none";

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={[
                      styles.th,
                      column.align === "end" ? styles.alignEnd : "",
                      column.hideClass ? styles[column.hideClass] : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {column.sortField ? (
                      <button
                        type="button"
                        className={`${styles.sortButton} ${isSorted ? styles.sorted : ""}`}
                        onClick={() => onSort(column.sortField as SortField)}
                      >
                        {column.header}
                        <SortGlyph active={isSorted} order={order} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              <th scope="col" className={styles.thChevron}>
                <span className="sr-only">Open detail</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`skeleton-${index}`} className={styles.skeletonRow}>
                    {COLUMNS.map((column) => (
                      <td
                        key={column.key}
                        className={[
                          styles.td,
                          column.hideClass ? styles[column.hideClass] : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Skeleton width={column.key === "merchant" ? "72%" : "48%"} height="14px" />
                      </td>
                    ))}
                    <td className={styles.tdChevron} />
                  </tr>
                ))
              : rows.map((row) => (
                  <TransactionRow
                    key={row.id}
                    row={row}
                    selected={row.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortGlyph({ active, order }: { active: boolean; order: SortOrder }) {
  return (
    <svg
      className={`${styles.sortGlyph} ${active ? styles.sortGlyphActive : ""}`}
      width="8"
      height="12"
      viewBox="0 0 8 12"
      aria-hidden
    >
      <path
        d="M4 1L7 4.5H1L4 1Z"
        fill="currentColor"
        opacity={active && order === "asc" ? 1 : 0.28}
      />
      <path
        d="M4 11L1 7.5H7L4 11Z"
        fill="currentColor"
        opacity={active && order === "desc" ? 1 : 0.28}
      />
    </svg>
  );
}

interface RowProps {
  row: Transaction;
  selected: boolean;
  onSelect: (transaction: Transaction) => void;
}

function TransactionRow({ row, selected, onSelect }: RowProps) {
  const isRefund = row.flow === "REFUND";

  return (
    <tr
      className={[
        styles.tr,
        selected ? styles.selected : "",
        row.is_quarantined ? styles.quarantined : "",
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={0}
      // The row is the control. A screen reader announces it as a button and
      // Enter/Space open it, matching what a mouse click does.
      role="button"
      aria-label={`${row.merchant}, ${formatRupees(row.amount_paise)}, ${humanizeStatus(
        row.status,
      )}, ${formatDate(row.occurred_at)}`}
      onClick={() => onSelect(row)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(row);
        }
      }}
    >
      <td className={`${styles.td} ${styles.cellDate}`} data-cell="date">
        {/* Cells stay display:table-cell; the stacking happens on an inner
            element. Setting display:flex on a <td> takes it out of the table
            layout algorithm and its borders stop lining up with the row. */}
        <span className={styles.dateStack}>
          <span className={styles.dateMain}>{formatDate(row.occurred_at)}</span>
          <span className={styles.dateTime}>{formatTime(row.occurred_at)}</span>
        </span>
      </td>

      <td className={`${styles.td} ${styles.cellMerchant}`} data-cell="merchant">
        <span className={styles.merchant}>{row.merchant}</span>
        <span className={styles.externalId}>{row.external_id}</span>
      </td>

      <td className={`${styles.td} ${styles.hideMd}`} data-cell="category">
        {row.category ? (
          <span className={styles.category}>{row.category}</span>
        ) : (
          <span className={styles.uncategorised}>Uncategorised</span>
        )}
      </td>

      <td className={`${styles.td} ${styles.hideLg} ${styles.method}`} data-cell="method">
        {humanizeMethod(row.method)}
      </td>

      <td className={`${styles.td} ${styles.cellStatus}`} data-cell="status">
        <span className={styles.statusStack}>
          <Badge tone={STATUS_TONE[row.status]} dot>
            {humanizeStatus(row.status)}
          </Badge>
          {row.quality_flags.length > 0 ? (
            <span
              className={styles.flagDot}
              title={`${row.quality_flags.length} data repair${
                row.quality_flags.length > 1 ? "s" : ""
              } applied — open the row for detail`}
            >
              <span className="sr-only">
                {row.quality_flags.length} data repairs applied to this row
              </span>
            </span>
          ) : null}
        </span>
      </td>

      <td className={`${styles.td} ${styles.alignEnd} ${styles.hideMd}`} data-cell="coins">
        {row.coins_earned > 0 ? (
          <CoinAmount coins={row.coins_earned} size="sm" />
        ) : (
          <span className={styles.zeroCoins}>—</span>
        )}
      </td>

      <td
        className={`${styles.td} ${styles.alignEnd} ${styles.cellAmount} ${
          isRefund ? styles.refund : ""
        }`}
        data-cell="amount"
      >
        {isRefund ? "+" : ""}
        {formatRupees(Math.abs(row.amount_paise))}
      </td>

      <td className={styles.tdChevron}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={styles.chevron}>
          <path
            d="M4.5 2L8.5 6L4.5 10"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </td>
    </tr>
  );
}
