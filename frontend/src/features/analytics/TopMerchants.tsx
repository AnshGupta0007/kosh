"use client";

import { formatNumber, formatRupeesCompact } from "@/lib/format";
import type { NamedSlice } from "@/lib/types";

import styles from "./TopMerchants.module.css";

interface TopMerchantsProps {
  merchants: NamedSlice[];
  onSelect: (merchant: string) => void;
  activeSearch: string;
}

/**
 * Where the money actually goes.
 *
 * Drawn with CSS-sized bars rather than a chart library — for a ranked list
 * of eight, a div with a width percentage is lighter, sharper and reflows
 * better than an SVG. Each row filters the table to that merchant.
 */
export function TopMerchants({ merchants, onSelect, activeSearch }: TopMerchantsProps) {
  const peak = Math.max(...merchants.map((merchant) => merchant.total_paise), 1);

  return (
    <ol className={styles.list}>
      {merchants.map((merchant, index) => {
        const active = activeSearch.toLowerCase() === merchant.name.toLowerCase();
        return (
          <li key={merchant.name}>
            <button
              type="button"
              className={`${styles.row} ${active ? styles.active : ""}`}
              onClick={() => onSelect(active ? "" : merchant.name)}
              aria-pressed={active}
            >
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.name}>{merchant.name}</span>
              <span className={styles.count}>
                {formatNumber(merchant.transaction_count)}×
              </span>
              <span className={styles.amount}>
                {formatRupeesCompact(merchant.total_paise)}
              </span>
              <span
                className={styles.bar}
                style={{ width: `${(merchant.total_paise / peak) * 100}%` }}
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
