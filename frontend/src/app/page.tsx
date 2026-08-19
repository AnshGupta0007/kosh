"use client";

import { Suspense } from "react";

import { AnalyticsPanel } from "@/features/analytics/AnalyticsPanel";
import { HeroSummary } from "@/features/analytics/HeroSummary";
import { TransactionsPanel } from "@/features/transactions/TransactionsPanel";
import { useFilters } from "@/lib/hooks/useFilters";

import styles from "./page.module.css";

/**
 * The dashboard.
 *
 * One `useFilters` call owns the URL state and hands the same filters to
 * both panels. That is the whole of the cross-filtering mechanism: the
 * charts write filters, the table reads them, and vice versa — neither
 * component knows the other exists.
 */
function Dashboard() {
  const { filters, update, apply, reset } = useFilters();

  return (
    <div className={styles.page} data-reveal>
      <h1 className="sr-only">Overview</h1>

      <HeroSummary filters={filters} />

      <AnalyticsPanel filters={filters} onApply={apply} />

      <TransactionsPanel
        filters={filters}
        onChange={update}
        onApply={apply}
        onReset={reset}
      />
    </div>
  );
}

export default function Page() {
  // useSearchParams needs a Suspense boundary to keep the route statically
  // renderable; the shell paints instantly and the filtered view streams in.
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <Dashboard />
    </Suspense>
  );
}
