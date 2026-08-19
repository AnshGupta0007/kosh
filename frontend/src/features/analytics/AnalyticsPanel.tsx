"use client";

import { Card, CardHeader, ErrorState, Stat } from "@/components/ui";
import {
  formatNumber,
  formatPercent,
  formatRupeesCompact,
  formatRupeesWhole,
  humanizeMethod,
} from "@/lib/format";
import { type FilterState, toggleValue } from "@/lib/filters";
import { useAnalytics } from "@/lib/hooks/useApi";

import { CategoryDonut } from "./CategoryDonut";
import { SpendHeatmap } from "./SpendHeatmap";
import { MonthlyTrend } from "./MonthlyTrend";
import { TopMerchants } from "./TopMerchants";
import styles from "./AnalyticsPanel.module.css";

interface AnalyticsPanelProps {
  filters: FilterState;
  onApply: (mutate: (state: FilterState) => FilterState) => void;
}

/**
 * Spend analytics, cross-filtered both ways.
 *
 * Charts → table: clicking a slice, a bar or a merchant row writes a filter
 * into the URL, and the table re-queries.
 * Table → charts: these charts are driven by the same URL filters, so
 * narrowing the table reshapes every chart here too. Neither side imports
 * the other; the URL is the only thing they share.
 */
export function AnalyticsPanel({ filters, onApply }: AnalyticsPanelProps) {
  const { data, isPending, isFetching, isError, error, refetch } = useAnalytics(filters);
  const kpis = data?.kpis;

  const toggleCategory = (category: string) =>
    onApply((state) => ({ ...state, categories: toggleValue(state.categories, category) }));

  const toggleMonth = (month: string) =>
    onApply((state) => ({ ...state, months: toggleValue(state.months, month) }));

  const setMerchant = (merchant: string) =>
    onApply((state) => ({ ...state, search: merchant }));

  // Clicking a day narrows to exactly that calendar day; clicking it again
  // clears the range rather than leaving the user stuck on one square.
  const selectDay = (date: string) =>
    onApply((state) => ({ ...state, dateFrom: date, dateTo: date }));

  if (isError) {
    return (
      <Card>
        <ErrorState
          title="Analytics unavailable"
          message={
            error?.code === "NETWORK_ERROR"
              ? "The Kosh API is not reachable. Start the backend and try again."
              : (error?.message ?? "Unexpected error.")
          }
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  return (
    <div className={styles.stack}>
      <Card className={styles.kpiCard} padding="md">
        <div className={styles.kpis} aria-busy={isFetching}>
          {/* Total spend is deliberately absent: it is the headline figure in
              the hero above, and repeating it here would spend the row's most
              valuable slot on something the reader has already been told. */}
          <Stat
            label="Payments"
            value={kpis ? formatNumber(kpis.transaction_count) : "—"}
            sub={kpis ? `Across ${kpis.distinct_merchants} merchants` : undefined}
            loading={isPending}
          />
          <Stat
            label="Average payment"
            value={kpis ? formatRupeesWhole(kpis.average_paise) : "—"}
            sub="Per successful payment"
            loading={isPending}
          />
          <Stat
            label="Largest payment"
            value={kpis ? formatRupeesCompact(kpis.largest_paise) : "—"}
            sub={
              kpis && kpis.total_refund_paise > 0
                ? `${formatRupeesCompact(kpis.total_refund_paise)} refunded back`
                : "No refunds in this view"
            }
            loading={isPending}
          />
          <Stat
            label="Success rate"
            value={kpis ? formatPercent(kpis.success_rate) : "—"}
            tone={kpis && kpis.success_rate < 90 ? "negative" : "positive"}
            sub={
              kpis
                ? `${formatNumber(kpis.failed_count)} failed · ${formatNumber(
                    kpis.pending_count,
                  )} pending`
                : undefined
            }
            loading={isPending}
          />
          <Stat
            label="Coins earned"
            value={kpis ? formatNumber(kpis.coins_earned) : "—"}
            tone="accent"
            sub="1 coin per ₹100, capped at 100 per payment"
            loading={isPending}
          />
        </div>
      </Card>

      <Card as="section" aria-labelledby="heatmap-heading">
        <CardHeader
          id="heatmap-heading"
          title="A year of spending, every day of it"
          subtitle="One square per day, shaded by how much went out. Click any day to filter."
        />
        {data ? (
          <SpendHeatmap
            days={data.by_day}
            selectedFrom={filters.dateFrom}
            selectedTo={filters.dateTo}
            onSelectDay={selectDay}
          />
        ) : (
          <div className={styles.chartSkeleton} />
        )}
      </Card>

      <div className={styles.chartGrid}>
        <Card as="section" aria-labelledby="category-heading">
          <CardHeader
            id="category-heading"
            title="Where the money goes"
            subtitle="Click a category to filter every view below"
          />
          {data ? (
            <CategoryDonut
              slices={data.by_category}
              selected={filters.categories}
              onToggle={toggleCategory}
              totalPaise={data.kpis.total_spend_paise}
            />
          ) : (
            <div className={styles.chartSkeleton} />
          )}
        </Card>

        <Card as="section" aria-labelledby="trend-heading">
          <CardHeader
            id="trend-heading"
            title="Monthly trend"
            subtitle="Calendar months in IST, quarantined rows excluded"
          />
          {data ? (
            <MonthlyTrend
              points={data.by_month}
              selected={filters.months}
              onToggle={toggleMonth}
            />
          ) : (
            <div className={styles.chartSkeleton} />
          )}
        </Card>
      </div>

      <div className={styles.chartGrid}>
        <Card as="section" aria-labelledby="merchants-heading">
          <CardHeader
            id="merchants-heading"
            title="Top merchants"
            subtitle="Click to search the table for that merchant"
          />
          {data ? (
            <TopMerchants
              merchants={data.top_merchants}
              onSelect={setMerchant}
              activeSearch={filters.search}
            />
          ) : (
            <div className={styles.chartSkeleton} />
          )}
        </Card>

        <Card as="section" aria-labelledby="methods-heading">
          <CardHeader
            id="methods-heading"
            title="How it was paid"
            subtitle="Share of spend by payment method"
          />
          {data ? (
            <ul className={styles.methods}>
              {data.by_method.map((method) => {
                const total = data.by_method.reduce((sum, item) => sum + item.total_paise, 0) || 1;
                const share = (method.total_paise / total) * 100;
                return (
                  <li key={method.name} className={styles.method}>
                    <div className={styles.methodHead}>
                      <span className={styles.methodName}>{humanizeMethod(method.name)}</span>
                      <span className={styles.methodValue}>
                        {formatRupeesCompact(method.total_paise)}
                        <span className={styles.methodShare}>{formatPercent(share, 0)}</span>
                      </span>
                    </div>
                    <div className={styles.track}>
                      <div className={styles.fill} style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.chartSkeleton} />
          )}
        </Card>
      </div>
    </div>
  );
}
