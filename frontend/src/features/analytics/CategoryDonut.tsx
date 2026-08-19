"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { formatNumber, formatPercent, formatRupeesCompact } from "@/lib/format";
import { useTheme } from "@/lib/hooks/useTheme";
import type { CategorySlice } from "@/lib/types";

import { categoryColor } from "./colors";
import styles from "./CategoryDonut.module.css";

interface CategoryDonutProps {
  slices: CategorySlice[];
  selected: string[];
  onToggle: (category: string) => void;
  totalPaise: number;
}

/**
 * Spend by category, and a filter control at the same time.
 *
 * Clicking a slice or a legend row toggles that category in the URL, which
 * re-filters the table below and every other chart. When a selection is
 * active the unselected slices dim rather than disappear, so the shape of
 * the whole stays legible while you drill in.
 *
 * The legend is the accessible half of this control: it is a real list of
 * real buttons with aria-pressed, so the chart is fully operable without a
 * mouse. The SVG itself is marked presentational.
 */
export function CategoryDonut({ slices, selected, onToggle, totalPaise }: CategoryDonutProps) {
  const { theme } = useTheme();
  const hasSelection = selected.length > 0;

  return (
    <div className={styles.layout}>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="total_paise"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
              onClick={(entry: unknown) => {
                const slice = entry as { category?: string };
                if (slice.category) onToggle(slice.category);
              }}
            >
              {slices.map((slice) => (
                <Cell
                  key={slice.slug}
                  fill={categoryColor(
                    slice.hue,
                    theme,
                    hasSelection && !selected.includes(slice.category),
                  )}
                  className={styles.slice}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className={styles.centre} aria-hidden>
          <p className={styles.centreLabel}>{hasSelection ? "Selected" : "Total spend"}</p>
          <p className={styles.centreValue}>{formatRupeesCompact(totalPaise)}</p>
        </div>
      </div>

      <ul className={styles.legend}>
        {slices.map((slice) => {
          const active = selected.includes(slice.category);
          return (
            <li key={slice.slug}>
              <button
                type="button"
                className={`${styles.legendRow} ${active ? styles.active : ""}`}
                onClick={() => onToggle(slice.category)}
                aria-pressed={active}
                title={`${formatNumber(slice.transaction_count)} payments`}
              >
                <span
                  className={styles.swatch}
                  style={{
                    background: categoryColor(slice.hue, theme, hasSelection && !active),
                  }}
                  aria-hidden
                />
                <span className={styles.name}>{slice.category}</span>
                <span className={styles.share}>{formatPercent(slice.share)}</span>
                <span className={styles.value}>{formatRupeesCompact(slice.total_paise)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
