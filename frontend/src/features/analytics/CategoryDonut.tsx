"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";

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
  const [active, setActive] = useState<number | null>(null);
  const hasSelection = selected.length > 0;
  const focused = active !== null ? slices[active] : null;

  return (
    <div className={styles.layout}>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={224}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="total_paise"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
              activeIndex={active ?? undefined}
              // The hovered slice grows outward, which is the affordance that
              // tells you the chart is a control and not a picture.
              // Recharts types activeShape's props as `unknown`; the runtime
              // value is the sector geometry, which is what Sector expects back.
              activeShape={(props: unknown) => (
                <Sector {...(props as React.ComponentProps<typeof Sector>)} outerRadius={108} />
              )}
              onMouseEnter={(_: unknown, index: number) => setActive(index)}
              onMouseLeave={() => setActive(null)}
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

        {/* The hole in the middle is the best label position a donut has —
            it reacts to whatever slice is under the cursor. */}
        <div className={styles.centre} aria-hidden>
          <p className={styles.centreLabel}>
            {focused ? focused.category : hasSelection ? "Selected" : "Total spend"}
          </p>
          <p className={styles.centreValue}>
            {formatRupeesCompact(focused ? focused.total_paise : totalPaise)}
          </p>
          <p className={styles.centreSub}>
            {focused
              ? `${formatPercent(focused.share)} · ${formatNumber(
                  focused.transaction_count,
                )} payments`
              : `${slices.length} categories`}
          </p>
        </div>
      </div>

      <ul className={styles.legend}>
        {slices.map((slice, index) => {
          const isActive = selected.includes(slice.category);
          return (
            <li key={slice.slug}>
              <button
                type="button"
                className={`${styles.legendRow} ${isActive ? styles.active : ""}`}
                onClick={() => onToggle(slice.category)}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                aria-pressed={isActive}
                title={`${formatNumber(slice.transaction_count)} payments`}
              >
                <span
                  className={styles.swatch}
                  style={{
                    background: categoryColor(slice.hue, theme, hasSelection && !isActive),
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
