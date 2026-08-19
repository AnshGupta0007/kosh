"use client";

import { useState } from "react";

import { Card, EmptyState, ErrorState, SegmentedControl } from "@/components/ui";
import { formatNumber, formatRupeesCompact } from "@/lib/format";
import { hasActiveFilters, type FilterState } from "@/lib/filters";
import { useFilterOptions, useTransactions } from "@/lib/hooks/useApi";
import type { SortField, Transaction } from "@/lib/types";

import { FilterBar } from "./FilterBar";
import { FilterChips } from "./FilterChips";
import { Pagination } from "./Pagination";
import { TransactionDrawer } from "./TransactionDrawer";
import { TransactionTable } from "./TransactionTable";
import styles from "./TransactionsPanel.module.css";

interface TransactionsPanelProps {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onApply: (mutate: (state: FilterState) => FilterState) => void;
  onReset: () => void;
}

/**
 * Everything the transactions view owns: toolbar, chips, table, pager and
 * the detail drawer.
 *
 * The panel holds only genuinely local state — which row is open, and how
 * dense the rows are. Every piece of state that changes what the *server*
 * returns lives in the URL instead, which is why the charts above can drive
 * this table without either component knowing about the other.
 */
export function TransactionsPanel({
  filters,
  onChange,
  onApply,
  onReset,
}: TransactionsPanelProps) {
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  const { data, isPending, isFetching, isError, error, refetch } = useTransactions(filters);
  const { data: options } = useFilterOptions();

  const filtered = hasActiveFilters(filters);
  const rows = data?.items ?? [];

  const toggleSort = (field: SortField) => {
    onChange({
      sort: field,
      order: filters.sort === field && filters.order === "desc" ? "asc" : "desc",
    });
  };

  return (
    <Card padding="none" as="section" aria-labelledby="transactions-heading">
      <header className={styles.head}>
        <div>
          <h2 id="transactions-heading" className={styles.title}>
            Transactions
          </h2>
          <p className={styles.subtitle}>
            {data ? (
              <>
                <strong>{formatNumber(data.meta.total)}</strong>{" "}
                {filtered ? "matching" : "total"}
                {/* Omit a zero: "₹0 paid" is noise on a refunds-only view. */}
                {data.filtered_total_paise > 0 ? (
                  <>
                    {" · "}
                    <strong>{formatRupeesCompact(data.filtered_total_paise)}</strong> paid
                  </>
                ) : null}
                {data.filtered_refund_paise > 0 ? (
                  <>
                    {" "}
                    · <strong className={styles.refunded}>
                      {formatRupeesCompact(data.filtered_refund_paise)}
                    </strong>{" "}
                    refunded
                  </>
                ) : null}
              </>
            ) : (
              "Loading the full ledger…"
            )}
          </p>
        </div>

        <div className={styles.headControls}>
          {/* Sorting lives in the header on narrow screens, where the table
              header is hidden and its sort buttons are unreachable. */}
          <div className={styles.mobileSort}>
            <SegmentedControl
              label="Sort by"
              size="sm"
              value={filters.sort}
              onChange={(value) => toggleSort(value as SortField)}
              options={[
                { value: "occurred_at", label: "Date" },
                { value: "amount", label: "Amount" },
                { value: "merchant", label: "Name" },
              ]}
            />
          </div>
          <div className={styles.density}>
            <SegmentedControl
              label="Row density"
              size="sm"
              value={density}
              onChange={setDensity}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </div>
        </div>
      </header>

      <FilterBar
        filters={filters}
        options={options}
        onChange={onChange}
        onReset={onReset}
        hasFilters={filtered}
      />

      <FilterChips filters={filters} onApply={onApply} onReset={onReset} />

      {isError ? (
        <ErrorState
          title="Could not load transactions"
          message={
            error?.code === "NETWORK_ERROR"
              ? "The Kosh API is not reachable. Check that the backend is running on port 8000."
              : (error?.message ?? "Unexpected error.")
          }
          onRetry={() => void refetch()}
        />
      ) : !isPending && rows.length === 0 ? (
        <EmptyState
          title="No transactions match these filters"
          message="Try widening the date or amount range, or clearing a filter or two."
          action={filtered ? { label: "Clear all filters", onClick: onReset } : undefined}
        />
      ) : (
        <>
          <TransactionTable
            rows={rows}
            loading={isPending}
            refreshing={isFetching}
            sort={filters.sort}
            order={filters.order}
            density={density}
            selectedId={selected?.id ?? null}
            pageSize={filters.pageSize}
            onSort={toggleSort}
            onSelect={setSelected}
          />
          {data ? (
            <Pagination
              meta={data.meta}
              queryMs={data.query_ms}
              onPageChange={(page) => onChange({ page })}
              onPageSizeChange={(size) => onChange({ pageSize: size, page: 1 })}
            />
          ) : null}
        </>
      )}

      <TransactionDrawer
        transaction={selected}
        onClose={() => setSelected(null)}
        onFilterMerchant={(merchant) => {
          onChange({ search: merchant });
          setSelected(null);
        }}
        onFilterCategory={(category) => {
          onChange({ categories: [category] });
          setSelected(null);
        }}
      />
    </Card>
  );
}
