"use client";

import { activeChips, type FilterState } from "@/lib/filters";

import styles from "./FilterChips.module.css";

interface FilterChipsProps {
  filters: FilterState;
  onApply: (mutate: (state: FilterState) => FilterState) => void;
  onReset: () => void;
}

/**
 * The active filter set, spelled out.
 *
 * With filters spread across a toolbar, a chart click and a URL, this row is
 * the one honest answer to "what am I actually looking at" — and every chip
 * is individually removable.
 */
export function FilterChips({ filters, onApply, onReset }: FilterChipsProps) {
  const chips = activeChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className={styles.row}>
      <span className={styles.leadIn}>Filtering by</span>
      <ul className={styles.chips}>
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => onApply(chip.clear)}
              aria-label={`Remove ${chip.label} filter: ${chip.value}`}
            >
              <span className={styles.chipLabel}>{chip.label}</span>
              <span className={styles.chipValue}>{chip.value}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className={styles.x}>
                <path
                  d="M1.5 1.5l7 7M8.5 1.5l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {chips.length > 1 ? (
        <button type="button" className={styles.clearAll} onClick={onReset}>
          Clear all
        </button>
      ) : null}
    </div>
  );
}
