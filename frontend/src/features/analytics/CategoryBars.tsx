"use client";

import { formatNumber, formatPercent, formatRupeesCompact } from "@/lib/format";
import type { CategorySlice } from "@/lib/types";

import styles from "./CategoryBars.module.css";

interface CategoryBarsProps {
  slices: CategorySlice[];
  selected: string[];
  onToggle: (category: string) => void;
}

/**
 * Spend by category, as a ranked bar list rather than a donut.
 *
 * Three reasons, in order of weight:
 *
 *   1. There are ten categories. A categorical palette tops out around
 *      eight distinguishable hues, and cycling or generating more is how
 *      charts become unreadable — so a ten-wedge donut cannot be coloured
 *      honestly in the first place.
 *   2. These categories are *nominal* and what is being compared is
 *      magnitude. Colouring each one differently spends the identity
 *      channel re-encoding what bar length already says. One hue for every
 *      bar is the correct answer, and it is also the calmer one.
 *   3. People read length far more accurately than angle. Ranking ten
 *      wedges by eye is guesswork; ranking ten bars is instant.
 *
 * Each row is a filter control, and the whole list stays keyboard operable
 * because every row is a real button.
 */
export function CategoryBars({ slices, selected, onToggle }: CategoryBarsProps) {
  const peak = Math.max(...slices.map((slice) => slice.total_paise), 1);
  const hasSelection = selected.length > 0;

  return (
    <ul className={styles.list}>
      {slices.map((slice) => {
        const active = selected.includes(slice.category);
        return (
          <li key={slice.slug}>
            <button
              type="button"
              className={`${styles.row} ${active ? styles.active : ""} ${
                hasSelection && !active ? styles.dimmed : ""
              }`}
              onClick={() => onToggle(slice.category)}
              aria-pressed={active}
            >
              <span className={styles.name}>{slice.category}</span>

              <span className={styles.track}>
                <span
                  className={styles.fill}
                  style={{ width: `${(slice.total_paise / peak) * 100}%` }}
                />
              </span>

              <span className={styles.value}>{formatRupeesCompact(slice.total_paise)}</span>
              <span className={styles.share}>{formatPercent(slice.share)}</span>
              <span className={styles.count}>
                {formatNumber(slice.transaction_count)}
                <span className={styles.countUnit}> payments</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
