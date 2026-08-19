"use client";

import styles from "./SegmentedControl.module.css";

interface Segment<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}

/**
 * Mutually exclusive choice, rendered as a radio group.
 *
 * Real radios rather than buttons, so arrow keys move between options the
 * way a keyboard user expects.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div className={`${styles.group} ${styles[size]}`} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label
          key={option.value}
          className={`${styles.segment} ${value === option.value ? styles.selected : ""}`}
          title={option.title}
        >
          <input
            type="radio"
            className={styles.radio}
            name={label}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
