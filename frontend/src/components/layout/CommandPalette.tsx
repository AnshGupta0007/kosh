"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Portal } from "@/components/ui";
import { humanizeMethod } from "@/lib/format";
import { toUrlParams, DEFAULT_FILTERS, type FilterState } from "@/lib/filters";
import { useFilterOptions } from "@/lib/hooks/useApi";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useTheme } from "@/lib/hooks/useTheme";

import styles from "./CommandPalette.module.css";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ⌘K palette.
 *
 * Filtering a 10,000-row table through dropdowns is fine with a mouse and
 * slow without one. This turns every filter and destination into one
 * keystroke plus a few letters. It is also the fastest way to demo the app:
 * type "travel", hit Enter, watch every chart and the table re-filter.
 *
 * Roving focus stays on the input while ↑/↓ move a virtual cursor, which is
 * the combobox pattern — the listbox is described by aria-activedescendant
 * rather than by moving DOM focus.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { data: options } = useFilterOptions();
  const { toggle: toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useFocusTrap(panelRef, open, onClose);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  const go = (patch: Partial<FilterState>) => {
    const params = toUrlParams({ ...DEFAULT_FILTERS, ...patch });
    router.push(params.toString() ? `/?${params}` : "/");
    onClose();
  };

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "nav-overview",
        group: "Go to",
        label: "Overview",
        hint: "Analytics and transactions",
        run: () => {
          router.push("/");
          onClose();
        },
      },
      {
        id: "nav-rewards",
        group: "Go to",
        label: "Rewards",
        hint: "Catalogue and redemption history",
        run: () => {
          router.push("/rewards");
          onClose();
        },
      },
      {
        id: "nav-quality",
        group: "Go to",
        label: "Data health",
        hint: "What we repaired in the source file",
        run: () => {
          router.push("/data-health");
          onClose();
        },
      },
      {
        id: "filter-failed",
        group: "Filters",
        label: "Show failed payments",
        run: () => go({ statuses: ["FAILED"] }),
      },
      {
        id: "filter-pending",
        group: "Filters",
        label: "Show pending payments",
        run: () => go({ statuses: ["PENDING"] }),
      },
      {
        id: "filter-refunds",
        group: "Filters",
        label: "Show refunds only",
        hint: "Negative amounts in the source data",
        run: () => go({ flow: "REFUND" }),
      },
      {
        id: "filter-large",
        group: "Filters",
        label: "Show payments over ₹50,000",
        run: () => go({ minAmount: "50000", sort: "amount", order: "desc" }),
      },
      {
        id: "filter-reset",
        group: "Filters",
        label: "Clear all filters",
        run: () => go({}),
      },
      {
        id: "theme",
        group: "App",
        label: "Toggle light / dark theme",
        run: () => {
          toggleTheme();
          onClose();
        },
      },
    ];

    options?.categories.forEach((category) =>
      list.push({
        id: `cat-${category}`,
        group: "Categories",
        label: category,
        hint: "Filter to this category",
        run: () => go({ categories: [category] }),
      }),
    );

    options?.methods.forEach((method) =>
      list.push({
        id: `pm-${method}`,
        group: "Payment methods",
        label: humanizeMethod(method),
        run: () => go({ methods: [method] }),
      }),
    );

    options?.merchants.forEach((merchant) =>
      list.push({
        id: `merchant-${merchant}`,
        group: "Merchants",
        label: merchant,
        hint: "Search the table for this merchant",
        run: () => go({ search: merchant }),
      }),
    );

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, router]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? commands.filter(
          (command) =>
            command.label.toLowerCase().includes(needle) ||
            command.group.toLowerCase().includes(needle),
        )
      : commands;
    return matches.slice(0, 40);
  }, [commands, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Keep the highlighted row in view as the cursor moves.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (value + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (value - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      results[cursor]?.run();
    }
  };

  let lastGroup = "";

  return (
    <Portal>
      <div className={styles.overlay}>
        <div className={styles.backdrop} onClick={onClose} aria-hidden />
        <div
          ref={panelRef}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div className={styles.inputRow}>
            <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden className={styles.searchIcon}>
              <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M9.4 9.4L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              className={styles.input}
              placeholder="Search filters, merchants, pages…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
              aria-activedescendant={results[cursor]?.id}
              autoComplete="off"
              // The palette exists to be typed into the instant it opens.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <kbd className={styles.esc}>esc</kbd>
          </div>

          <ul className={styles.results} id="command-results" role="listbox" ref={listRef}>
            {results.length === 0 ? (
              <li className={styles.empty}>No matches for “{query}”</li>
            ) : (
              results.map((command, index) => {
                const showGroup = command.group !== lastGroup;
                lastGroup = command.group;
                return (
                  <li key={command.id}>
                    {showGroup ? <p className={styles.group}>{command.group}</p> : null}
                    <button
                      type="button"
                      id={command.id}
                      role="option"
                      aria-selected={index === cursor}
                      data-active={index === cursor}
                      className={`${styles.result} ${index === cursor ? styles.activeResult : ""}`}
                      onMouseEnter={() => setCursor(index)}
                      onClick={command.run}
                      tabIndex={-1}
                    >
                      <span className={styles.resultLabel}>{command.label}</span>
                      {command.hint ? (
                        <span className={styles.resultHint}>{command.hint}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <footer className={styles.footer}>
            <span>
              <kbd className={styles.miniKbd}>↑</kbd>
              <kbd className={styles.miniKbd}>↓</kbd> navigate
            </span>
            <span>
              <kbd className={styles.miniKbd}>↵</kbd> run
            </span>
            <span>
              <kbd className={styles.miniKbd}>esc</kbd> close
            </span>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
