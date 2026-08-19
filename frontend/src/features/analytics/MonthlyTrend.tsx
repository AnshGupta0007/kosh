"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber, formatRupees, formatRupeesCompact } from "@/lib/format";
import type { MonthPoint } from "@/lib/types";

import styles from "./MonthlyTrend.module.css";

interface MonthlyTrendProps {
  points: MonthPoint[];
  selected: string[];
  onToggle: (month: string) => void;
}

/**
 * Monthly spend, and the second half of the cross-filter.
 *
 * Clicking a bar toggles that month in the URL. Unselected bars dim instead
 * of vanishing so the trend line of the year is never lost while drilling in.
 */
export function MonthlyTrend({ points, selected, onToggle }: MonthlyTrendProps) {
  const hasSelection = selected.length > 0;
  const peak = Math.max(...points.map((point) => point.total_paise), 0);

  return (
    <div className={styles.wrap}>
      <ResponsiveContainer width="100%" height={228}>
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barGap={2}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatRupeesCompact(value)}
            width={58}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as MonthPoint;
              return (
                <div className={styles.tooltip}>
                  <p className={styles.tooltipTitle}>{point.label}</p>
                  <p className={styles.tooltipRow}>
                    <span>Spent</span>
                    <strong>{formatRupees(point.total_paise)}</strong>
                  </p>
                  {point.refund_paise > 0 ? (
                    <p className={styles.tooltipRow}>
                      <span>Refunded</span>
                      <strong className={styles.positive}>
                        {formatRupees(point.refund_paise)}
                      </strong>
                    </p>
                  ) : null}
                  <p className={styles.tooltipRow}>
                    <span>Payments</span>
                    <strong>{formatNumber(point.transaction_count)}</strong>
                  </p>
                  <p className={styles.tooltipRow}>
                    <span>Coins</span>
                    <strong className={styles.coins}>
                      {formatNumber(point.coins_earned)}
                    </strong>
                  </p>
                  <p className={styles.tooltipHint}>Click to filter to this month</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="total_paise"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
            onClick={(entry: unknown) => {
              const point = entry as { month?: string };
              if (point.month) onToggle(point.month);
            }}
          >
            {points.map((point) => {
              const dimmed = hasSelection && !selected.includes(point.month);
              const isPeak = point.total_paise === peak;
              return (
                <Cell
                  key={point.month}
                  className={styles.bar}
                  fill={
                    dimmed
                      ? "var(--surface-active)"
                      : isPeak
                        ? "var(--chart-primary)"
                        : "var(--chart-secondary)"
                  }
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className={styles.caption}>
        <span className={styles.key}>
          <span className={`${styles.dot} ${styles.dotPeak}`} aria-hidden /> Highest month
        </span>
        <span className={styles.key}>
          <span className={`${styles.dot} ${styles.dotBase}`} aria-hidden /> Other months
        </span>
        <span className={styles.hint}>Click a bar to filter</span>
      </p>
    </div>
  );
}
