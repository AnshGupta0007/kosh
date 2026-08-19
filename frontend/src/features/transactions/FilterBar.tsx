"use client";

import { useEffect, useId, useRef, useState } from "react";

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

  // The last value this component itself wrote to the URL.
  //
  // Without it the two effects below fight each other and eat keystrokes:
  // the debounced push updates the URL, the URL change re-runs the sync
  // effect, and the sync effect rewinds the input to a value that is now
  // 250ms out of date — deleting whatever was typed in the meantime. Typing
  // "swiggy" would land as "sigy".
  //
  // Comparing against this ref tells the two cases apart: an echo of our own
  // write is ignored, while a genuinely external change (a cleared chip, the
  // back button, the command palette) still syncs the box.
  const lastPushedSearch = useRef(filters.search);

  // Push the settled value up.
  useEffect(() => {
    if (debouncedSearch === lastPushedSearch.current) return;
    lastPushedSearch.current = debouncedSearch;
    onChange({ search: debouncedSearch });
    // Keyed on the debounced value alone; re-running on `filters.search`
    // would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Sync the box when the URL changed from somewhere other than this input.
  useEffect(() => {
    if (filters.search === lastPushedSearch.current) return;
    lastPushedSearch.current = filters.search;
    setSearchDraft(filters.search);
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
