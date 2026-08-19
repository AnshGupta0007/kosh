"use client";

import { useEffect, useId, useRef, useState } from "react";

import styles from "./MultiSelect.module.css";

interface MultiSelectProps {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  /** Turns CREDIT_CARD into "Credit Card" without changing the stored value. */
  formatOption?: (value: string) => string;
  placeholder?: string;
}

/**
 * Multi-select popover, hand-built.
 *
 * A native <select multiple> cannot be styled to match, and cannot show a
 * count of what is selected. This keeps the semantics that matter:
 * aria-expanded on the trigger, real checkboxes inside, Escape to close and
 * focus returned to the trigger, and a click outside to dismiss.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  formatOption = (value) => value,
  placeholder = "Any",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? formatOption(selected[0]!)
        : `${selected.length} selected`;

  return (
    <div className={styles.root} ref={rootRef}>
      <span className={styles.label} id={`${listId}-label`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${selected.length > 0 ? styles.active : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${listId}-label`}
      >
        <span className={styles.summary}>{summary}</span>
        {selected.length > 0 ? <span className={styles.count}>{selected.length}</span> : null}
        <svg className={styles.chevron} width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div className={styles.popover} id={listId} role="group" aria-label={label}>
          <div className={styles.options}>
            {options.map((option) => (
              <label key={option} className={styles.option}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selected.includes(option)}
                  onChange={() => toggle(option)}
                />
                <span className={styles.tick} aria-hidden>
                  <svg width="9" height="9" viewBox="0 0 10 10">
                    <path
                      d="M1.5 5.2l2.4 2.4L8.5 2.6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.optionLabel}>{formatOption(option)}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 ? (
            <button type="button" className={styles.clear} onClick={() => onChange([])}>
              Clear {label.toLowerCase()}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
