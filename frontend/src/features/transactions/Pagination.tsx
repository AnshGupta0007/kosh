"use client";

import { SegmentedControl } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { PageMeta } from "@/lib/types";

import styles from "./Pagination.module.css";

interface PaginationProps {
  meta: PageMeta;
  queryMs: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Page controls plus an honest read-out of where you are in the result set.
 *
 * The page-number window keeps first and last always reachable and elides
 * the middle, so the control stays the same width whether there are 3 pages
 * or 200.
 */
export function Pagination({ meta, queryMs, onPageChange, onPageSizeChange }: PaginationProps) {
  const from = (meta.page - 1) * meta.page_size + 1;
  const to = Math.min(meta.page * meta.page_size, meta.total);

  return (
    <nav className={styles.bar} aria-label="Transactions pagination">
      <p className={styles.summary}>
        {meta.total === 0 ? (
          "No transactions"
        ) : (
          <>
            <strong>
              {formatNumber(from)}–{formatNumber(to)}
            </strong>{" "}
            of {formatNumber(meta.total)}
          </>
        )}
        <span className={styles.timing} title="Time spent in PostgreSQL for this page">
          {queryMs} ms
        </span>
      </p>

      <div className={styles.controls}>
        <div className={styles.pageSize}>
          <span className={styles.pageSizeLabel}>Rows</span>
          <SegmentedControl
            label="Rows per page"
            size="sm"
            value={String(meta.page_size)}
            onChange={(value) => onPageSizeChange(Number(value))}
            options={[
              { value: "25", label: "25" },
              { value: "50", label: "50" },
              { value: "100", label: "100" },
            ]}
          />
        </div>

        <div className={styles.pager}>
          <button
            type="button"
            className={styles.step}
            onClick={() => onPageChange(meta.page - 1)}
            disabled={!meta.has_previous}
            aria-label="Previous page"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M7.5 2L3.5 6L7.5 10"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <ul className={styles.pages}>
            {pageWindow(meta.page, meta.total_pages).map((entry, index) =>
              entry === "…" ? (
                <li key={`gap-${index}`} className={styles.gap} aria-hidden>
                  …
                </li>
              ) : (
                <li key={entry}>
                  <button
                    type="button"
                    className={`${styles.page} ${entry === meta.page ? styles.current : ""}`}
                    onClick={() => onPageChange(entry)}
                    aria-current={entry === meta.page ? "page" : undefined}
                    aria-label={`Page ${entry}`}
                  >
                    {entry}
                  </button>
                </li>
              ),
            )}
          </ul>

          <button
            type="button"
            className={styles.step}
            onClick={() => onPageChange(meta.page + 1)}
            disabled={!meta.has_next}
            aria-label="Next page"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M4.5 2L8.5 6L4.5 10"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}

/** First, last, and a window around the current page. */
export function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current]);
  for (const offset of [-1, 1]) {
    const page = current + offset;
    if (page > 1 && page < total) pages.add(page);
  }
  // Keep the control a stable width near the ends.
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("…");
    result.push(page);
    previous = page;
  }
  return result;
}
