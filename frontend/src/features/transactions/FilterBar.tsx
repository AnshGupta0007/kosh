"use client";

import { useEffect, useId, useState } from "react";

import { Button, Icon, Input, MultiSelect, SegmentedControl } from "@/components/ui";
import { humanizeMethod } from "@/lib/format";
import { activeChips, type FilterState } from "@/lib/filters";
import { useDebounced } from "@/lib/hooks/useDebounced";
import type { FilterOptions, PaymentMethod, TransactionStatus } from "@/lib/types";

import styles from "./FilterBar.module.css";

interface FilterBarProps {
  filters: FilterState;
  options?: FilterOptions;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  hasFilters: boolean;
}

/**
 * All the filters, combinable.
 *
 * The search box keeps its own local state so typing is never at the mercy
 * of a round trip; the debounced value is what gets pushed into the URL.
 * Everything else writes straight through — a checkbox has no intermediate
 * state worth protecting.
 */
export function FilterBar({ filters, options, onChange, onReset, hasFilters }: FilterBarProps) {
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const debouncedSearch = useDebounced(searchDraft, 250);
  // Below 700px the seven controls filled the whole screen before a single
  // row of data was visible, so everything except search collapses behind a
  // toggle. On desktop the panel is `display: contents`, so the layout is
  // exactly as if this wrapper did not exist.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();
  const activeCount = activeChips(filters).filter((chip) => chip.key !== "search").length;

  // Push the settled value up.
  useEffect(() => {
    if (debouncedSearch !== filters.search) onChange({ search: debouncedSearch });
    // Deliberately keyed on the debounced value alone: re-running this when
    // `filters.search` changes would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep the box in step when the URL changes from elsewhere (a cleared chip,
  // the back button, the command palette).
  useEffect(() => {
    setSearchDraft((current) => (current === filters.search ? current : filters.search));
  }, [filters.search]);

  return (
    <div className={styles.bar}>
      <div className={styles.searchCell}>
        <Input
          label="Search merchant"
          placeholder="Swiggy, IndiGo, TXN2025…"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onClear={() => setSearchDraft("")}
          type="search"
          iconLeft={
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M9.4 9.4L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      <button
        type="button"
        className={styles.toggle}
        onClick={() => setFiltersOpen((open) => !open)}
        aria-expanded={filtersOpen}
        aria-controls={panelId}
      >
        <Icon name="chevron-down" size={16} className={filtersOpen ? styles.toggleOpen : ""} />
        {filtersOpen ? "Hide filters" : "Filters"}
        {activeCount > 0 ? <span className={styles.toggleCount}>{activeCount}</span> : null}
      </button>

      <div
        id={panelId}
        className={`${styles.advanced} ${filtersOpen ? styles.advancedOpen : ""}`}
      >
        <MultiSelect
          label="Category"
        options={options?.categories ?? []}
        selected={filters.categories}
        onChange={(categories) => onChange({ categories })}
      />

      <MultiSelect
        label="Status"
        options={options?.statuses ?? []}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ statuses: statuses as TransactionStatus[] })}
      />

      <MultiSelect
        label="Method"
        options={options?.methods ?? []}
        selected={filters.methods}
        onChange={(methods) => onChange({ methods: methods as PaymentMethod[] })}
        formatOption={humanizeMethod}
      />

      <div className={styles.range}>
        <Input
          label="From"
          type="date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(event) => onChange({ dateFrom: event.target.value })}
        />
        <Input
          label="To"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(event) => onChange({ dateTo: event.target.value })}
        />
      </div>

      <div className={styles.range}>
        <Input
          label="Min ₹"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={filters.minAmount}
          onChange={(event) => onChange({ minAmount: event.target.value })}
        />
        <Input
          label="Max ₹"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Any"
          value={filters.maxAmount}
          onChange={(event) => onChange({ maxAmount: event.target.value })}
        />
      </div>

      <div className={styles.flowCell}>
        <span className={styles.flowLabel}>Type</span>
        <SegmentedControl
          label="Transaction type"
          size="sm"
          value={filters.flow || "all"}
          onChange={(value) => onChange({ flow: value === "all" ? "" : (value as "DEBIT") })}
          options={[
            { value: "all", label: "All" },
            { value: "DEBIT", label: "Payments" },
            { value: "REFUND", label: "Refunds", title: "Negative amounts in the source file" },
          ]}
        />
      </div>

        {hasFilters ? (
          <div className={styles.resetCell}>
            <Button variant="ghost" size="sm" onClick={onReset}>
              Reset all
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
