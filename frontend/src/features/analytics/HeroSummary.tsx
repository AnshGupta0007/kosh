"use client";

import { PaymentCard } from "@/components/brand/PaymentCard";
import { Badge, Skeleton } from "@/components/ui";
import { formatNumber, formatRupeesCompact, formatRupeesWhole } from "@/lib/format";
import { hasActiveFilters, type FilterState } from "@/lib/filters";
import { useAnalytics, useBalance, useMe } from "@/lib/hooks/useApi";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { useMounted } from "@/lib/hooks/useMounted";

import styles from "./HeroSummary.module.css";

interface HeroSummaryProps {
  filters: FilterState;
}

/**
 * The opening statement.
 *
 * The card on the left gives the product a physical subject; the headline
 * figure on the right is the one number the whole dashboard is about, set
 * in the display serif at a size nothing else competes with. The sparkline
 * underneath is the monthly series drawn as a plain SVG path — a chart
 * library for twelve points and no axes would be dead weight.
 */
export function HeroSummary({ filters }: HeroSummaryProps) {
  // Same query key as the panel below, so this shares that request rather
  // than issuing a second one.
  const { data: analytics, isPending: loading } = useAnalytics(filters);
  const { data: balance } = useBalance();
  const { data: me } = useMe();
  const mounted = useMounted();
  const filtered = hasActiveFilters(filters);
  // Filtering to refunds makes every money figure describe refunds, so the
  // words have to follow — calling a refund total "spend" is just wrong.
  const refundsOnly = filters.flow === "REFUND";

  const spend = analytics?.kpis.total_spend_paise ?? 0;
  const animatedSpend = useCountUp(spend);

  return (
    <section className={styles.hero} aria-label="Account summary">
      <PaymentCard
        holder={me?.display_name ?? "Kosh Member"}
        last4={me?.card_last4 ?? "4291"}
        coins={balance?.balance ?? 0}
        coinValuePaise={balance?.coin_value_paise ?? 10}
        loading={!mounted || !balance}
      />

      <div className={styles.summary}>
        <div className={styles.headingRow}>
          <p className={styles.eyebrow}>
            {refundsOnly ? "Refunded to you" : filtered ? "Filtered spend" : "Spend this year"}
          </p>
          {filtered ? <Badge tone="accent">Filters active</Badge> : null}
        </div>

        {loading ? (
          <Skeleton width="60%" height="4rem" />
        ) : (
          <p className={styles.headline}>{formatRupeesWhole(animatedSpend)}</p>
        )}

        <p className={styles.subline}>
          {analytics ? (
            refundsOnly ? (
              <>
                across <strong>{formatNumber(analytics.kpis.transaction_count)}</strong> refunds
                from <strong>{analytics.kpis.distinct_merchants}</strong> merchants
              </>
            ) : (
              <>
                across <strong>{formatNumber(analytics.kpis.transaction_count)}</strong> payments
                to <strong>{analytics.kpis.distinct_merchants}</strong> merchants
                {analytics.kpis.total_refund_paise > 0 ? (
                  <>
                    , with <strong className={styles.refund}>
                      {formatRupeesCompact(analytics.kpis.total_refund_paise)}
                    </strong>{" "}
                    refunded back
                  </>
                ) : null}
              </>
            )
          ) : (
            "Loading the full ledger…"
          )}
        </p>

        {analytics && analytics.by_month.length > 1 ? (
          <>
            <Sparkline points={analytics.by_month.map((month) => month.total_paise)} />
            <p className={styles.sparkLabel}>
              <span>{analytics.by_month[0]?.label}</span>
              <span aria-hidden>—</span>
              <span>{analytics.by_month[analytics.by_month.length - 1]?.label}</span>
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Twelve-ish points, no axes, no library — a filled path and a stroke.
 * `preserveAspectRatio="none"` lets it stretch to whatever width it gets.
 */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const width = 100;
  const height = 28;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;

  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = `M${coords.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Monthly spend trend"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path className={styles.sparkArea} d={area} fill="url(#spark-fill)" />
      <path
        className={styles.sparkLine}
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        // pathLength normalises the dash maths to 0–1 regardless of the real
        // geometry, so the draw-on works without measuring the path.
        pathLength={1}
      />
    </svg>
  );
}
